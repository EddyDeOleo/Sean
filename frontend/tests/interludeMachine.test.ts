import { describe, expect, it } from "vitest";
import {
  PLANCHETTE_ROUTE,
  initialInterlude,
  interludeReducer,
  isActive,
  isGamePhase,
  type InterludeEvent,
  type InterludeState,
} from "../src/features/interlude/interludeMachine";

const run = (events: InterludeEvent[], from: InterludeState = initialInterlude) => events.reduce(interludeReducer, from);
const toActive = (): InterludeEvent[] => [{ type: "BEGIN", snapshotId: "a" }, { type: "INTRO_DONE" }];
const toInterruption = (): InterludeEvent[] => [...toActive(), { type: "SETTLED" }, { type: "INTERRUPT" }];
const toGame = (): InterludeEvent[] => [...toInterruption(), { type: "SECOND_LINE" }, { type: "INTERRUPTION_DONE", gameAllowed: true }];
const toPlaying = (): InterludeEvent[] => [...toGame(), { type: "GAME_READY" }];

describe("interlude machine: the path", () => {
  it("starts off and begins once per snapshot", () => {
    expect(initialInterlude.phase).toBe("OFF");
    const started = run([{ type: "BEGIN", snapshotId: "a" }]);
    expect(started.phase).toBe("OUIJA_INTRODUCTION");
    expect(interludeReducer(started, { type: "BEGIN", snapshotId: "b" })).toBe(started);
    const ended = run([...toInterruption(), { type: "SKIP" }]);
    expect(ended.phase).toBe("REPORT_AVAILABLE");
    expect(interludeReducer(ended, { type: "BEGIN", snapshotId: "a" })).toBe(ended);
    expect(interludeReducer(ended, { type: "BEGIN", snapshotId: "b" }).phase).toBe("OUIJA_INTRODUCTION");
  });

  it("goes board, interruption, game", () => {
    expect(run(toActive()).phase).toBe("OUIJA_ACTIVE");
    expect(run(toInterruption()).phase).toBe("NARRATIVE_INTERRUPTION");
    expect(run(toInterruption()).beat).toBe(1);
    expect(run([...toInterruption(), { type: "SECOND_LINE" }]).beat).toBe(2);
    expect(run(toGame()).phase).toBe("GAME_INITIALIZATION");
    expect(run(toPlaying()).phase).toBe("GAME_ACTIVE");
    expect(run(toGame()).attempts).toBe(1);
  });

  it("the planchette only moves forward and the interruption needs a settled board", () => {
    const active = run(toActive());
    expect(interludeReducer(active, { type: "INTERRUPT" })).toBe(active);
    const stepped = interludeReducer(active, { type: "STEP", step: 2 });
    expect(stepped.step).toBe(2);
    expect(interludeReducer(stepped, { type: "STEP", step: 1 })).toBe(stepped);
    const settled = interludeReducer(stepped, { type: "SETTLED" });
    expect(settled.boardSettled).toBe(true);
    expect(settled.step).toBe(PLANCHETTE_ROUTE.length - 1);
  });

  it("without a game the interruption goes straight to the report", () => {
    const end = run([...toInterruption(), { type: "SECOND_LINE" }, { type: "INTERRUPTION_DONE", gameAllowed: false }]);
    expect(end.phase).toBe("REPORT_AVAILABLE");
    expect(end.endedBy).toBe("NO_GAME");
  });
});

describe("interlude machine: every exit ends at the report", () => {
  it.each([
    ["escape", [{ type: "ESCAPED" }] as InterludeEvent[], "ESCAPED"],
    ["quit", [{ type: "QUIT" }] as InterludeEvent[], "QUIT"],
    ["skip in the game", [{ type: "SKIP" }] as InterludeEvent[], "SKIPPED"],
    ["caught and give up", [{ type: "CAUGHT" }, { type: "GIVE_UP" }] as InterludeEvent[], "GAVE_UP"],
  ])("%s", (_name, events, endedBy) => {
    const after = run([...toPlaying(), ...events]);
    expect(after.endedBy).toBe(endedBy);
    expect(run([...toPlaying(), ...events, { type: "FINISH" }]).phase).toBe("REPORT_AVAILABLE");
  });

  it("a game that fails to start or breaks ends at the report", () => {
    expect(run([...toGame(), { type: "GAME_FAILED" }])).toMatchObject({ phase: "REPORT_AVAILABLE", endedBy: "GAME_FAILED" });
    expect(run([...toPlaying(), { type: "GAME_FAILED" }])).toMatchObject({ phase: "REPORT_AVAILABLE", endedBy: "GAME_FAILED" });
  });

  it("a game that breaks while the caught screen is up also ends at the report", () => {
    expect(run([...toPlaying(), { type: "CAUGHT" }, { type: "GAME_FAILED" }])).toMatchObject({ phase: "REPORT_AVAILABLE", endedBy: "GAME_FAILED" });
  });

  it("skipping before the game ends at the report at once", () => {
    for (const events of [[{ type: "BEGIN", snapshotId: "a" }], toActive(), toInterruption()] as InterludeEvent[][]) {
      expect(run([...events, { type: "SKIP" }])).toMatchObject({ phase: "REPORT_AVAILABLE", endedBy: "SKIPPED" });
    }
  });

  it("being caught allows a retry and counts the attempts", () => {
    const caught = run([...toPlaying(), { type: "CAUGHT" }]);
    expect(caught.phase).toBe("PLAYER_CAUGHT");
    const again = run([{ type: "RETRY" }, { type: "GAME_READY" }], caught);
    expect(again.phase).toBe("GAME_ACTIVE");
    expect(again.attempts).toBe(2);
  });
});

describe("interlude machine: events that do not apply are ignored", () => {
  const phases: Array<[string, InterludeEvent[]]> = [
    ["off", []],
    ["introduction", [{ type: "BEGIN", snapshotId: "a" }]],
    ["active", toActive()],
    ["interruption", toInterruption()],
    ["initialization", toGame()],
    ["playing", toPlaying()],
  ];
  it.each(phases)("nothing finishes the interlude from %s without its own events", (_n, events) => {
    const state = run(events);
    for (const event of [{ type: "FINISH" }, { type: "GIVE_UP" }, { type: "RETRY" }] as InterludeEvent[]) {
      expect(interludeReducer(state, event)).toBe(state);
    }
  });

  it("game events do nothing outside the game", () => {
    const state = run(toInterruption());
    for (const event of [{ type: "CAUGHT" }, { type: "ESCAPED" }, { type: "QUIT" }, { type: "GAME_READY" }, { type: "GAME_FAILED" }] as InterludeEvent[]) {
      expect(interludeReducer(state, event)).toBe(state);
    }
  });

  it("a finished interlude ignores skip and stray game events", () => {
    const done = run([...toPlaying(), { type: "ESCAPED" }, { type: "FINISH" }]);
    expect(done.phase).toBe("REPORT_AVAILABLE");
    for (const event of [{ type: "SKIP" }, { type: "CAUGHT" }, { type: "RETRY" }, { type: "INTERRUPT" }] as InterludeEvent[]) {
      expect(interludeReducer(done, event)).toBe(done);
    }
  });

  it("classifies phases", () => {
    expect(isActive("OFF")).toBe(false);
    expect(isActive("REPORT_AVAILABLE")).toBe(false);
    expect(isActive("GAME_ACTIVE")).toBe(true);
    expect(isGamePhase("PLAYER_CAUGHT")).toBe(true);
    expect(isGamePhase("OUIJA_ACTIVE")).toBe(false);
  });
});
