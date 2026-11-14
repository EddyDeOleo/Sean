import { describe, expect, it } from "vitest";
import type { InterludePhase } from "../src/features/interlude/interludeMachine";
import type { ThreatInfo } from "../src/features/game/world";
import {
  HEARTBEAT_MIN_TENSION,
  MonsterSteps,
  PresenceSounds,
  cueForPhase,
  heartbeatBpm,
  moodForPhase,
  planForGameEvent,
  planForOuijaStep,
  type CuePlan,
} from "../src/features/audio/director";

const PHASES: InterludePhase[] = [
  "OFF", "OUIJA_INTRODUCTION", "OUIJA_ACTIVE", "NARRATIVE_INTERRUPTION", "GAME_INITIALIZATION", "GAME_ACTIVE",
  "PLAYER_CAUGHT", "GAME_COMPLETED", "GAME_SKIPPED", "REPORT_AVAILABLE",
];

describe("moodForPhase and cueForPhase", () => {
  it("maps every phase", () => {
    expect(Object.fromEntries(PHASES.map((p) => [p, moodForPhase(p)]))).toEqual({
      OFF: "silent",
      OUIJA_INTRODUCTION: "ouija",
      OUIJA_ACTIVE: "ouija",
      NARRATIVE_INTERRUPTION: "tension",
      GAME_INITIALIZATION: "tension",
      GAME_ACTIVE: "tension",
      PLAYER_CAUGHT: "tension",
      GAME_COMPLETED: "escape",
      GAME_SKIPPED: "silent",
      REPORT_AVAILABLE: "silent",
    });
  });
  it("starts a phase with a cue only where one is meant", () => {
    expect(cueForPhase("OUIJA_INTRODUCTION")).toBe("whisper");
    expect(cueForPhase("NARRATIVE_INTERRUPTION")).toBe("glitch");
    expect(cueForPhase("GAME_COMPLETED")).toBe("escape");
    for (const phase of ["OFF", "OUIJA_ACTIVE", "GAME_ACTIVE", "PLAYER_CAUGHT", "REPORT_AVAILABLE", "GAME_SKIPPED"] as InterludePhase[]) {
      expect(cueForPhase(phase)).toBeNull();
    }
  });
});

describe("planForOuijaStep", () => {
  const cues = (plans: CuePlan[]): string[] => plans.map((p) => p.cue);

  it("is silent at rest and for invalid steps", () => {
    expect(planForOuijaStep(0, false)).toEqual([]);
    expect(planForOuijaStep(6, false)).toEqual([]);
    expect(planForOuijaStep(-1, false)).toEqual([]);
    expect(planForOuijaStep(1.5, false)).toEqual([]);
    expect(planForOuijaStep(Number.NaN, false)).toEqual([]);
  });

  it("slides with a contact tick on every move", () => {
    for (const step of [1, 2, 3, 4, 5]) {
      expect(cues(planForOuijaStep(step, false))).toEqual(expect.arrayContaining(["planchetteSlide", "planchetteTick"]));
    }
  });

  it("adds a creak only on some moves", () => {
    const withCreak = [1, 2, 3, 4, 5].filter((step) => cues(planForOuijaStep(step, false)).includes("woodCreak"));
    expect(withCreak).toEqual([3]);
  });

  it("knocks and thuds when the planchette settles", () => {
    expect(cues(planForOuijaStep(5, true))).toEqual(["woodThud", "woodKnock"]);
    expect(cues(planForOuijaStep(0, true))).toEqual(["woodThud", "woodKnock"]);
  });

  it("is deterministic", () => {
    for (const step of [0, 1, 3, 5]) expect(planForOuijaStep(step, false)).toEqual(planForOuijaStep(step, false));
  });
});

describe("planForGameEvent", () => {
  const threat: ThreatInfo = { level: 0.5, distance: 4, pan: -0.6, awake: true };

  it("maps the ordinary events", () => {
    expect(planForGameEvent({ type: "FOOTSTEP", sprinting: true }, null)).toEqual([{ cue: "footstepRun" }]);
    expect(planForGameEvent({ type: "FOOTSTEP", sprinting: false }, null)).toEqual([{ cue: "footstep" }]);
    expect(planForGameEvent({ type: "FLASHLIGHT", on: true }, null)).toEqual([{ cue: "flashlight" }]);
    expect(planForGameEvent({ type: "GATE_OPENED" }, null)).toEqual([{ cue: "door" }]);
    expect(planForGameEvent({ type: "ESCAPED" }, null)).toEqual([]);
    expect(planForGameEvent({ type: "MONSTER_STATE", state: "PURSUING", previous: "SEARCHING" }, threat)).toEqual([{ cue: "growl", options: { pan: -0.6 } }]);
    expect(planForGameEvent({ type: "MONSTER_STATE", state: "SEARCHING", previous: "DORMANT" }, threat)).toEqual([]);
  });

  it("is caught with a scream and a heavy impact, both priority, when the jumpscare is on", () => {
    const plans = planForGameEvent({ type: "CAUGHT" }, null, { jumpscare: true });
    expect(plans.map((p) => p.cue)).toEqual(["scream", "caught"]);
    expect(plans.every((p) => p.options?.priority === true)).toBe(true);
  });

  it("is caught with only a soft impact when the jumpscare is off, and by default", () => {
    for (const plans of [planForGameEvent({ type: "CAUGHT" }, null, { jumpscare: false }), planForGameEvent({ type: "CAUGHT" }, null)]) {
      expect(plans).toHaveLength(1);
      expect(plans[0]!.cue).toBe("caught");
      expect(plans[0]!.options?.priority).toBeUndefined();
      expect(plans[0]!.options?.gain).toBeLessThan(1);
    }
  });
});

describe("heartbeatBpm", () => {
  it("runs from 55 to 130 bpm and clamps", () => {
    expect(heartbeatBpm(0)).toBe(55);
    expect(heartbeatBpm(1)).toBe(130);
    expect(heartbeatBpm(0.5)).toBeCloseTo(92.5, 5);
    expect(heartbeatBpm(2)).toBe(130);
    expect(heartbeatBpm(-1)).toBe(55);
    expect(heartbeatBpm(Number.NaN)).toBe(55);
  });
});

describe("MonsterSteps", () => {
  it("has an uneven gait and louder steps nearer", () => {
    const steps = new MonsterSteps();
    const plans: CuePlan[] = [];
    for (let i = 0; i < 300; i += 1) {
      const plan = steps.update({ level: 0.5, distance: 3, pan: 0.2, awake: true }, 0.1);
      if (plan) plans.push(plan);
    }
    expect(plans.length).toBeGreaterThan(10);
    expect(new Set(plans.slice(0, 8).map((p) => p.options?.gain)).size).toBeGreaterThan(1);
    expect(plans.every((p) => p.cue === "monsterStep" && p.options?.pan === 0.2)).toBe(true);
  });
});

describe("PresenceSounds", () => {
  const sleeping: ThreatInfo = { level: 0, distance: 30, pan: 0, awake: false };
  const run = (presence: PresenceSounds, info: ThreatInfo, seconds: number, from = 0): CuePlan[][] => {
    const calls: CuePlan[][] = [];
    for (let i = 0; i < Math.round(seconds * 10); i += 1) calls.push(presence.update(info, 0.1, from + i * 0.1));
    return calls;
  };
  const count = (calls: CuePlan[][], cue: string): number => calls.flat().filter((p) => p.cue === cue).length;

  it("returns nothing on most calls", () => {
    const calls = run(new PresenceSounds(), { level: 0.6, distance: 5, pan: 0, awake: true }, 60);
    const empty = calls.filter((c) => c.length === 0).length;
    expect(empty / calls.length).toBeGreaterThan(0.5);
    expect(run(new PresenceSounds(), sleeping, 60).filter((c) => c.length === 0).length / 600).toBeGreaterThan(0.95);
  });

  it("makes no creature sound while the creature sleeps, only the house", () => {
    const plans = run(new PresenceSounds(), sleeping, 120).flat();
    expect(plans.length).toBeGreaterThan(5);
    for (const plan of plans) expect(["drip", "pipeTick", "woodCreak", "rumble"]).toContain(plan.cue);
  });

  it("walks only when awake, paced by nearness", () => {
    const far = count(run(new PresenceSounds(), { level: 0.2, distance: 12, pan: 0, awake: true }, 30), "monsterStep");
    const near = count(run(new PresenceSounds(), { level: 0.9, distance: 2, pan: 0, awake: true }, 30), "monsterStep");
    const asleep = count(run(new PresenceSounds(), { level: 0.9, distance: 2, pan: 0, awake: false }, 30), "monsterStep");
    expect(asleep).toBe(0);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    expect(count(run(new PresenceSounds(), { level: 0.1, distance: 17, pan: 0, awake: true }, 30), "monsterStep")).toBe(0);
  });

  it("breathes within range, faster and louder when closer, panned toward the creature", () => {
    const near = run(new PresenceSounds(), { level: 0.8, distance: 2, pan: -0.5, awake: true }, 30);
    const far = run(new PresenceSounds(), { level: 0.2, distance: 12, pan: -0.5, awake: true }, 30);
    const out = run(new PresenceSounds(), { level: 0.1, distance: 15, pan: 0, awake: true }, 30);
    expect(count(near, "breath")).toBeGreaterThan(count(far, "breath"));
    expect(count(far, "breath")).toBeGreaterThan(0);
    expect(count(out, "breath")).toBe(0);
    const gain = (calls: CuePlan[][]): number => calls.flat().find((p) => p.cue === "breath")!.options!.gain!;
    expect(gain(near)).toBeGreaterThan(gain(far));
    expect(near.flat().find((p) => p.cue === "breath")!.options!.pan).toBe(-0.5);
  });

  it("beats at the rate the tension asks for, as a priority cue, and stops below 0.2", () => {
    for (const level of [0.3, 0.5, 1]) {
      const beats = count(run(new PresenceSounds(), { level, distance: 4, pan: 0, awake: true }, 60), "heartbeat");
      expect(Math.abs(beats - heartbeatBpm(level))).toBeLessThanOrEqual(2);
    }
    const quiet = run(new PresenceSounds(), { level: HEARTBEAT_MIN_TENSION - 0.01, distance: 4, pan: 0, awake: true }, 60);
    expect(count(quiet, "heartbeat")).toBe(0);
    const heart = run(new PresenceSounds(), { level: 0.6, distance: 4, pan: 0, awake: true }, 10).flat().find((p) => p.cue === "heartbeat");
    expect(heart?.options?.priority).toBe(true);
  });

  it("warns once as the creature comes close, and again only after it has gone and 14 s have passed", () => {
    const presence = new PresenceSounds();
    const close: ThreatInfo = { level: 0.8, distance: 3, pan: 0.3, awake: true };
    const away: ThreatInfo = { level: 0.2, distance: 12, pan: 0, awake: true };
    const first = run(presence, close, 20);
    expect(count(first, "proximity")).toBe(1);
    const gone = run(presence, away, 20, 20);
    const again = run(presence, close, 20, 40);
    expect(count(gone, "proximity")).toBe(0);
    expect(count(again, "proximity")).toBe(1);
  });

  it("schedules the house by game time: deterministic, spaced, within the cue set", () => {
    const a = run(new PresenceSounds(), sleeping, 120).flatMap((calls, i) => calls.map((p) => ({ i, ...p })));
    const b = run(new PresenceSounds(), sleeping, 120).flatMap((calls, i) => calls.map((p) => ({ i, ...p })));
    expect(a).toEqual(b);
    const times = a.map((p) => p.i / 10);
    expect(times[0]).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < times.length; i += 1) expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(4.9);
    expect(new Set(a.map((p) => p.cue)).size).toBeGreaterThan(1);
  });

  it("follows the game clock, not the number of calls", () => {
    const fine = new PresenceSounds();
    const coarse = new PresenceSounds();
    const fineTimes: number[] = [];
    const coarseTimes: number[] = [];
    for (let t = 0; t < 60; t += 0.1) if (fine.update(sleeping, 0.1, t).length) fineTimes.push(Math.round(t));
    for (let t = 0; t < 60; t += 0.5) if (coarse.update(sleeping, 0.5, t).length) coarseTimes.push(Math.round(t));
    expect(coarseTimes.length).toBe(fineTimes.length);
  });

  it("does not play a backlog after a stall", () => {
    const presence = new PresenceSounds();
    // The first call after a jump from 0 to 500 s plays at most one sound, and the next sounds are the normal spacing apart.
    expect(presence.update(sleeping, 0.1, 500).length).toBeLessThanOrEqual(1);
    const after = run(presence, sleeping, 60, 500.1).flat();
    expect(after.length).toBeLessThanOrEqual(7);
  });

  it("reset restores the start, so a retry hears the same house", () => {
    const presence = new PresenceSounds();
    const first = run(presence, { level: 0.6, distance: 5, pan: 0, awake: true }, 40);
    presence.reset();
    const second = run(presence, { level: 0.6, distance: 5, pan: 0, awake: true }, 40);
    expect(second).toEqual(first);
  });
});
