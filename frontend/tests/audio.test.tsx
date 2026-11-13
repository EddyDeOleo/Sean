import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "../src/app/App";
import { AudioController } from "../src/features/audio/AudioController";
import { MonsterSteps, cueForPhase, moodForPhase, planForGameEvent } from "../src/features/audio/director";
import type { InterludePhase } from "../src/features/interlude/interludeMachine";
import type { GameProps, RenderGame } from "../src/features/interlude/gameApi";
import { createIndexedDbStorage } from "../src/features/report/reportStore";
import type { CallOutcome } from "../src/services/advisorClient";
import type { ThreatInfo } from "../src/features/game/world";
import { FakeContext } from "./fakeAudio";
import { act, byRole, click, render, type } from "./renderHelpers";
import { capabilitiesFixture, clone, complete, insufficient, interpretInvestigate, profileRich, repositoriesFixture } from "./fixtures";

const tid = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const ok = <T,>(value: T): CallOutcome<T> => ({ kind: "ok", value: clone(value) });

describe("the mapping from the interlude to sound", () => {
  it("is silent outside the interlude and before the report", () => {
    for (const phase of ["OFF", "REPORT_AVAILABLE", "GAME_SKIPPED"] as InterludePhase[]) expect(moodForPhase(phase)).toBe("silent");
  });
  it("gives each phase a mood and the key moments a cue", () => {
    expect(moodForPhase("OUIJA_ACTIVE")).toBe("search");
    expect(moodForPhase("GAME_ACTIVE")).toBe("tension");
    expect(cueForPhase("OUIJA_INTRODUCTION")).toBe("whisper");
    expect(cueForPhase("NARRATIVE_INTERRUPTION")).toBe("glitch");
    expect(cueForPhase("GAME_COMPLETED")).toBe("escape");
    expect(cueForPhase("PLAYER_CAUGHT")).toBeNull();
  });
  it("maps game events to cues, and places the growl where the creature is", () => {
    const threat: ThreatInfo = { level: 0.5, distance: 4, pan: -0.6, awake: true };
    expect(planForGameEvent({ type: "FOOTSTEP", sprinting: true }, null)).toEqual({ cue: "footstepRun" });
    expect(planForGameEvent({ type: "FOOTSTEP", sprinting: false }, null)).toEqual({ cue: "footstep" });
    expect(planForGameEvent({ type: "CAUGHT" }, null)).toEqual({ cue: "caught" });
    expect(planForGameEvent({ type: "MONSTER_STATE", state: "PURSUING", previous: "SEARCHING" }, threat)).toEqual({ cue: "growl", options: { pan: -0.6 } });
    expect(planForGameEvent({ type: "MONSTER_STATE", state: "SEARCHING", previous: "DORMANT" }, threat)).toBeNull();
    expect(planForGameEvent({ type: "ESCAPED" }, null)).toBeNull();
  });
  it("paces the creature's steps by distance, and is silent while it sleeps or is far", () => {
    const steps = new MonsterSteps();
    const count = (info: ThreatInfo): number => {
      let n = 0;
      for (let i = 0; i < 100; i += 1) if (steps.update(info, 0.1)) n += 1;
      return n;
    };
    expect(count({ level: 0.9, distance: 1, pan: 0, awake: false })).toBe(0);
    expect(count({ level: 0.1, distance: 14, pan: 0, awake: true })).toBe(0);
    const far = count({ level: 0.2, distance: 8, pan: 0, awake: true });
    const near = count({ level: 0.9, distance: 1.5, pan: 0.4, awake: true });
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe("controller buses, position and cleanup", () => {
  it("routes beds and effects through separate buses and releases everything", async () => {
    const context = new FakeContext();
    const audio = new AudioController(() => context);
    await audio.enable();
    audio.setMood("search");
    audio.cue("clue");
    audio.cue("growl", { pan: -2, gain: 0.5 });
    const panners = context.nodes.filter((n) => n.kind === "panner");
    expect(panners).toHaveLength(1);
    expect((panners[0] as unknown as { pan: { value: number } }).pan.value).toBe(-1);
    audio.setAmbientVolume(0.2);
    audio.setEffectsVolume(0.4);
    audio.setTension(1);
    expect(audio.getSnapshot()).toMatchObject({ ambient: 0.2, effects: 0.4, enabled: true });
    audio.dispose();
    expect(context.liveNodes()).toEqual([]);
    expect(context.closeCount).toBe(1);
  });

  it("plays centred when the browser has no stereo panner", async () => {
    const context = new FakeContext();
    (context as unknown as { createStereoPanner?: unknown }).createStereoPanner = undefined;
    const audio = new AudioController(() => context);
    await audio.enable();
    audio.cue("growl", { pan: 1 });
    expect(context.nodes.some((n) => n.kind === "panner")).toBe(false);
    expect(audio.getSnapshot().activeCues).toBe(1);
    audio.dispose();
  });

  it("does nothing before sound is enabled", () => {
    const audio = new AudioController(() => {
      throw new Error("must not create a context");
    });
    audio.cue("clue");
    audio.setMood("tension");
    audio.setTension(1);
    expect(audio.getSnapshot().enabled).toBe(false);
  });
});

// ---- inside the application ----------------------------------------------------------------------------------------

async function advance(ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(50, left));
    });
  }
}

let contexts: FakeContext[];
let lastGame: GameProps | null;
const fakeGame: RenderGame = (props) => {
  lastGame = props;
  return <div data-testid="fake-game">game</div>;
};

function appProps(over: Partial<AppProps> & { result?: unknown } = {}): AppProps {
  const { result, ...rest } = over;
  let n = 0;
  return {
    storage: createIndexedDbStorage(new IDBFactory()),
    systemPrefersReducedMotion: false,
    audioFactory: () => {
      const context = new FakeContext();
      contexts.push(context);
      return context;
    },
    listRepositories: async () => ok(repositoriesFixture().body.repositories),
    getCapabilities: async () => ok(capabilitiesFixture().body),
    analysisDeps: {
      interpret: (async () => ok(interpretInvestigate().body)) as never,
      investigate: (async () => result ?? { kind: "result", result: clone(complete().body) }) as never,
      profile: (async () => ok(profileRich().body)) as never,
      makeId: () => `snap-${++n}`,
      now: () => new Date("2026-11-12T10:00:00.000Z"),
    },
    ...rest,
  };
}
async function ask(): Promise<void> {
  await type(byRole("textbox", "Your request") as HTMLTextAreaElement, "sample - Why does src/billing.py exist?");
  await click(byRole("button", "Investigate") as HTMLElement);
  await advance(100);
}
async function turnSoundOn(): Promise<void> {
  await click(byRole("button", "Settings") as HTMLElement);
  await advance(100);
  await click(tid("sound-toggle")!);
  await advance(100);
  await click(byRole("button", "New Investigation") as HTMLElement);
  await advance(100);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
  window.localStorage.clear();
  contexts = [];
  lastGame = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("sound in the application", () => {
  it("is off by default: no audio context exists until the user turns it on", async () => {
    await render(<App {...appProps()} />);
    await advance(100);
    await ask();
    await advance(12000);
    expect(contexts).toHaveLength(0);
  });

  it("the settings page turns it on and off and shows the state", async () => {
    await render(<App {...appProps()} />);
    await advance(100);
    await click(byRole("button", "Settings") as HTMLElement);
    await advance(100);
    expect(tid("sound-status")!.textContent).toBe("Sound is off.");
    await click(tid("sound-toggle")!);
    await advance(100);
    expect(contexts).toHaveLength(1);
    expect(tid("sound-status")!.textContent).toBe("Sound is on.");
    await click(tid("mute")!);
    expect(tid("sound-status")!.textContent).toBe("Sound is on but muted.");
    expect(JSON.parse(window.localStorage.getItem("sean.settings.v1")!).muted).toBe(true);
    await click(tid("sound-toggle")!);
    await advance(100);
    expect(contexts[0]!.liveNodes()).toEqual([]);
    expect(tid("sound-status")!.textContent).toBe("Sound is off.");
    // "On" is never stored.
    expect(window.localStorage.getItem("sean.settings.v1")).not.toMatch(/enabled/);
  });

  it("volume levels are stored", async () => {
    await render(<App {...appProps()} />);
    await advance(100);
    await click(byRole("button", "Settings") as HTMLElement);
    await advance(100);
    const range = tid("ambient-range") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(range, "0.4");
      range.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(JSON.parse(window.localStorage.getItem("sean.settings.v1")!).ambient).toBe(0.4);
  });

  it("plays during the interlude and is completely silent afterwards", async () => {
    await render(<App {...appProps()} />);
    await advance(100);
    await turnSoundOn();
    await ask();
    await advance(1700);
    const context = contexts[0]!;
    expect(context.liveSources().length).toBeGreaterThan(0);
    expect(document.querySelector('[data-testid="interlude"]')).not.toBeNull();
    await click(tid("skip-interlude")!);
    await advance(4000);
    expect(tid("report")).not.toBeNull();
    expect(context.liveSources()).toEqual([]);
  });

  it("the game receives the sound toggle, events, and the threat reports", async () => {
    await render(<App {...appProps({ renderGame: fakeGame })} />);
    await advance(100);
    await turnSoundOn();
    await ask();
    await advance(1600 + 5 * 700 + 700 + 2000 + 2600 + 3000 + 200);
    expect(tid("fake-game")).not.toBeNull();
    const game = lastGame!;
    expect(game.sound!.enabled).toBe(true);
    // The fake context never finishes a cue by itself; the browser does.
    await act(async () => contexts[0]!.endAllSources());
    await act(async () => game.onEvent!({ type: "CLUE_COLLECTED", clue: { id: "c", kind: "ATMOSPHERE", classification: null, label: "x", detail: null }, collected: 1, total: 3 }));
    await act(async () => game.onThreat!({ level: 0.8, distance: 2, pan: 0.5, awake: true }));
    await act(async () => game.onEvent!({ type: "MONSTER_STATE", state: "PURSUING", previous: "SEARCHING" }));
    expect(contexts[0]!.nodes.some((n) => n.kind === "panner")).toBe(true);
    await act(async () => game.onQuit());
    await advance(3000);
    expect(contexts[0]!.liveSources()).toEqual([]);
  });

  it("makes no sound for insufficient evidence", async () => {
    await render(<App {...appProps({ result: { kind: "result", result: clone(insufficient().body) } })} />);
    await advance(100);
    await turnSoundOn();
    await ask();
    await advance(12000);
    expect(contexts[0]!.nodes.filter((n) => n.kind === "oscillator" || n.kind === "buffersource")).toEqual([]);
  });

  it("unmounting the application releases the sound", async () => {
    const view = await render(<App {...appProps()} />);
    await advance(100);
    await turnSoundOn();
    await ask();
    await advance(1700);
    await view.unmount();
    expect(contexts[0]!.liveNodes()).toEqual([]);
    expect(contexts[0]!.closeCount).toBeGreaterThan(0);
  });
});
