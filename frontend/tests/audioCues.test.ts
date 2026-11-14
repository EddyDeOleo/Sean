import { describe, expect, it } from "vitest";
import {
  AudioController,
  INTENSE_CUES,
  MAX_CONCURRENT_CUES,
  PRIORITY_EXTRA_CUES,
  cueDurationSeconds,
  type Cue,
} from "../src/features/audio/AudioController";
import { FakeContext, FakeNode, FakeParam } from "./fakeAudio";

const NEW_CUES: Cue[] = [
  "woodKnock", "woodThud", "planchetteTick", "planchetteSlide", "woodCreak", "scream", "breath", "heartbeat", "drip", "pipeTick",
  "rumble", "proximity",
];
const OLD_CUES: Cue[] = [
  "settle", "glitch", "whisper", "clue", "caught", "door", "escape", "planchette", "footstep", "footstepRun", "flashlight", "growl",
  "monsterStep",
];

async function setup(configure?: (context: FakeContext) => void) {
  const context = new FakeContext();
  configure?.(context);
  const controller = new AudioController(() => context);
  await controller.enable();
  return { context, controller };
}

/** Everything a node was told to do, as text. Two runs that did the same things give the same text. */
function trace(context: FakeContext): string {
  return JSON.stringify(
    context.nodes.map((node) => {
      const params: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(node)) if (value instanceof FakeParam) params[key] = [String(value.value), ...value.events];
      return [node.kind, params];
    }),
  );
}

describe("the procedural cues", () => {
  for (const cue of [...NEW_CUES, ...OLD_CUES]) {
    it(`${cue} builds, starts every source, and releases every node when it ends`, async () => {
      const { context, controller } = await setup();
      const baseline = context.liveNodes().length;
      controller.cue(cue);
      expect(controller.getSnapshot().activeCues).toBe(1);
      expect(controller.getSnapshot().failed).toBe(false);
      const sources = context.nodes.filter((n) => n.kind === "oscillator" || n.kind === "buffersource");
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.every((n) => n.started)).toBe(true);
      expect(context.liveNodes().length).toBeGreaterThan(baseline);
      context.endAllSources();
      expect(controller.getSnapshot().activeCues).toBe(0);
      expect(context.liveNodes().length).toBe(baseline);
      controller.dispose();
      expect(context.liveNodes()).toEqual([]);
    });

    it(`${cue} has a positive duration of at most 2.7 s`, () => {
      const seconds = cueDurationSeconds(cue);
      expect(seconds).toBeGreaterThan(0.05);
      expect(seconds).toBeLessThanOrEqual(2.7);
    });
  }

  it("uses a handful of nodes per cue", async () => {
    const { context, controller } = await setup();
    const baseline = context.nodes.length;
    for (const cue of NEW_CUES) {
      const before = context.nodes.length;
      controller.cue(cue, { priority: true });
      expect(context.nodes.length - before).toBeLessThan(32);
      context.endAllSources();
    }
    expect(context.nodes.length).toBeGreaterThan(baseline);
    controller.dispose();
  });

  it("schedules identically every time, and varies repeated cues", async () => {
    const run = async (): Promise<{ text: string; first: string; second: string }> => {
      const { context, controller } = await setup();
      const start = context.nodes.length;
      const marks: number[] = [];
      controller.cue("woodKnock");
      marks.push(context.nodes.length);
      context.endAllSources();
      controller.cue("woodKnock");
      marks.push(context.nodes.length);
      const all = JSON.parse(trace(context)) as unknown[];
      return { text: JSON.stringify(all), first: JSON.stringify(all.slice(start, marks[0])), second: JSON.stringify(all.slice(marks[0], marks[1])) };
    };
    const a = await run();
    const b = await run();
    expect(a.text).toBe(b.text);
    expect(a.first).not.toBe(a.second);
  });

  it("plays centred without a panner and without a waveshaper", async () => {
    const { context, controller } = await setup((c) => {
      (c as unknown as { createStereoPanner?: unknown }).createStereoPanner = undefined;
      (c as unknown as { createWaveShaper?: unknown }).createWaveShaper = undefined;
    });
    controller.cue("scream", { pan: 0.7, priority: true });
    expect(controller.getSnapshot()).toMatchObject({ activeCues: 1, failed: false });
    expect(context.nodes.some((n) => n.kind === "panner" || n.kind === "waveshaper")).toBe(false);
    context.endAllSources();
    expect(controller.getSnapshot().activeCues).toBe(0);
    controller.dispose();
    expect(context.liveNodes()).toEqual([]);
  });

  it("distorts the scream through a waveshaper when the context has one, with a bounded curve", async () => {
    const { context, controller } = await setup();
    controller.cue("scream", { priority: true });
    const shapers = context.nodes.filter((n) => n.kind === "waveshaper") as unknown as { curve: Float32Array | null }[];
    // One is the master limiter, the other is the scream's distortion.
    expect(shapers).toHaveLength(2);
    for (const shaper of shapers) {
      expect(shaper.curve).not.toBeNull();
      expect(Math.max(...Array.from(shaper.curve!, Math.abs))).toBeLessThanOrEqual(1);
    }
    const limiter = shapers[0]!.curve!;
    expect(Math.max(...Array.from(limiter, Math.abs))).toBeLessThan(0.71);
    controller.dispose();
    expect(context.liveNodes()).toEqual([]);
  });

  it("pans a cue within -1..1 and releases the panner", async () => {
    const { context, controller } = await setup();
    controller.cue("breath", { pan: -3 });
    const panner = context.nodes.find((n) => n.kind === "panner") as unknown as { pan: { value: number } };
    expect(panner.pan.value).toBe(-1);
    context.endAllSources();
    expect(context.liveNodes().filter((n) => n.kind === "panner")).toEqual([]);
    controller.dispose();
  });
});

describe("priority cues", () => {
  it("lets non-priority cues fill MAX_CONCURRENT_CUES and no more", async () => {
    const { controller } = await setup();
    for (let i = 0; i < MAX_CONCURRENT_CUES + 4; i += 1) controller.cue("drip");
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES);
    controller.dispose();
  });

  it("lets priority cues exceed the cap by PRIORITY_EXTRA_CUES, and no further", async () => {
    const { controller } = await setup();
    for (let i = 0; i < MAX_CONCURRENT_CUES; i += 1) controller.cue("drip");
    controller.cue("drip");
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES);
    for (let i = 0; i < PRIORITY_EXTRA_CUES + 2; i += 1) controller.cue("heartbeat", { priority: true });
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES + PRIORITY_EXTRA_CUES);
    // Ordinary cues are still refused while it is that full.
    controller.cue("drip");
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES + PRIORITY_EXTRA_CUES);
    controller.dispose();
  });

  it("plays the scream and the caught impact even when the cap is full", async () => {
    const { context, controller } = await setup();
    for (let i = 0; i < MAX_CONCURRENT_CUES; i += 1) controller.cue("drip");
    controller.cue("scream", { priority: true });
    controller.cue("caught", { priority: true });
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES + 2);
    controller.dispose();
    expect(context.liveNodes()).toEqual([]);
  });

  it("releases priority cues like any other when they end", async () => {
    const { context, controller } = await setup();
    controller.cue("heartbeat", { priority: true });
    context.endAllSources();
    expect(controller.getSnapshot().activeCues).toBe(0);
    controller.dispose();
  });
});

describe("intense cues", () => {
  const firstGainLevel = (context: FakeContext, from: number): number => {
    const out = context.nodes.slice(from).find((n) => n.kind === "gain") as unknown as { gain: FakeParam };
    return Number(out.gain.events[0]!.replace("set:", ""));
  };

  it("is allowed by default and reported in the snapshot", async () => {
    const { controller } = await setup();
    expect(controller.getSnapshot().intenseAllowed).toBe(true);
    expect(INTENSE_CUES).toEqual(expect.arrayContaining(["scream", "caught"]));
    controller.dispose();
  });

  it("skips the scream when not allowed, even with priority, and plays it again when allowed", async () => {
    const { controller } = await setup();
    controller.setIntenseAllowed(false);
    expect(controller.getSnapshot().intenseAllowed).toBe(false);
    controller.cue("scream", { priority: true });
    expect(controller.getSnapshot().activeCues).toBe(0);
    controller.setIntenseAllowed(true);
    controller.cue("scream", { priority: true });
    expect(controller.getSnapshot().activeCues).toBe(1);
    controller.dispose();
  });

  it("softens the caught impact when not allowed", async () => {
    const { context, controller } = await setup();
    let from = context.nodes.length;
    controller.cue("caught");
    const normal = firstGainLevel(context, from);
    context.endAllSources();
    controller.setIntenseAllowed(false);
    from = context.nodes.length;
    controller.cue("caught");
    const soft = firstGainLevel(context, from);
    expect(controller.getSnapshot().activeCues).toBe(1);
    expect(soft).toBeLessThan(normal * 0.5);
    // The soft variant has no noise crack.
    expect(context.nodes.slice(from).filter((n) => n.kind === "buffersource")).toHaveLength(0);
    controller.dispose();
  });

  it("does not cut a scream that is already playing", async () => {
    const { controller } = await setup();
    controller.cue("scream", { priority: true });
    controller.setIntenseAllowed(false);
    expect(controller.getSnapshot().activeCues).toBe(1);
    controller.dispose();
  });

  it("keeps working when muted or at volume zero: the master gain carries those", async () => {
    const { context, controller } = await setup();
    controller.setMuted(true);
    controller.cue("scream", { priority: true });
    const master = context.nodes.find((n) => n.kind === "gain") as unknown as { gain: FakeParam };
    expect(master.gain.value).toBe(0);
    controller.dispose();
  });
});

describe("the Ouija room bed", () => {
  it("starts a bed with crackle from a small cached buffer and releases it all", async () => {
    const { context, controller } = await setup();
    controller.setMood("ouija");
    expect(controller.getSnapshot()).toMatchObject({ mood: "ouija", activeBeds: 1, failed: false });
    const buffers = context.nodes.filter((n) => n.kind === "buffersource") as unknown as { buffer: { getChannelData(c: number): Float32Array } }[];
    expect(buffers.length).toBeGreaterThanOrEqual(4);
    const crackle = buffers.find((b) => b.buffer.getChannelData(0).length > 2 * 8000)!;
    expect(crackle).toBeDefined();
    const data = crackle.buffer.getChannelData(0);
    const pops = Array.from(data).filter((v) => Math.abs(v) > 0.1).length;
    expect(pops).toBeGreaterThan(20);
    expect(pops).toBeLessThan(data.length * 0.05);
    expect(context.nodes.filter((n) => n.kind === "oscillator").length).toBeLessThan(8);
    controller.setMood("tension");
    expect(controller.getSnapshot().activeBeds).toBe(2);
    controller.dispose();
    expect(context.liveNodes()).toEqual([]);
  });

  it("shares the crackle buffer between beds", async () => {
    const { context, controller } = await setup();
    controller.setMood("ouija");
    controller.setMood("tension");
    controller.setMood("ouija");
    const crackleBuffers = new Set(
      (context.nodes.filter((n) => n.kind === "buffersource") as unknown as { buffer: { getChannelData(c: number): Float32Array } }[])
        .filter((b) => b.buffer.getChannelData(0).length > 2 * 8000)
        .map((b) => b.buffer),
    );
    expect(crackleBuffers.size).toBe(1);
    controller.dispose();
  });
});

describe("failure", () => {
  it("swallows a failure inside a procedural cue after cleaning up", async () => {
    const { context, controller } = await setup();
    const original = context.createOscillator.bind(context);
    let calls = 0;
    context.createOscillator = () => {
      calls += 1;
      if (calls > 2) throw new Error("out of voices");
      return original();
    };
    controller.cue("scream", { priority: true });
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, failed: true });
    expect(context.liveNodes().filter((n: FakeNode) => n.kind === "oscillator")).toEqual([]);
  });
});
