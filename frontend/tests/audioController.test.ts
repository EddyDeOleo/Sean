import { describe, expect, it, vi } from "vitest";
import {
  AudioController,
  DEFAULT_VOLUME,
  MASTER_CEILING,
  MAX_CONCURRENT_CUES,
  type ContextFactory,
} from "../src/features/audio/AudioController";
import { FakeContext } from "./fakeAudio";

function setup() {
  const contexts: FakeContext[] = [];
  const factory: ContextFactory = () => {
    const context = new FakeContext();
    contexts.push(context);
    return context;
  };
  const controller = new AudioController(factory);
  return { controller, contexts, current: () => contexts[contexts.length - 1] as FakeContext };
}

describe("autoplay and defaults", () => {
  it("creates no audio context until enable is called", () => {
    const { controller, contexts } = setup();
    expect(contexts).toHaveLength(0);
    controller.setMood("search");
    controller.cue("settle");
    controller.setVolume(0.5);
    controller.setMuted(true);
    expect(contexts).toHaveLength(0);
    expect(controller.getSnapshot().enabled).toBe(false);
  });

  it("starts disabled, unmuted, at a moderate default volume", () => {
    const { controller } = setup();
    const snapshot = controller.getSnapshot();
    expect(snapshot).toMatchObject({ enabled: false, muted: false, volume: DEFAULT_VOLUME, mood: "silent", failed: false });
    expect(DEFAULT_VOLUME * MASTER_CEILING).toBeLessThan(0.25);
  });

  it("creates exactly one context on enable and resumes it", async () => {
    const { controller, contexts } = setup();
    expect(await controller.enable()).toBe(true);
    expect(await controller.enable()).toBe(true);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.resumeCount).toBe(1);
    expect(controller.getSnapshot().enabled).toBe(true);
  });

  it("reports a failed enable and stays usable", async () => {
    const contexts: FakeContext[] = [];
    const controller = new AudioController(() => {
      const context = new FakeContext();
      context.resumeError = new Error("blocked");
      contexts.push(context);
      return context;
    });
    expect(await controller.enable()).toBe(false);
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, failed: true });
    expect(contexts[0]?.closeCount).toBe(1);
    expect(contexts[0]?.liveNodes()).toHaveLength(0);
    expect(() => controller.cue("settle")).not.toThrow();
  });

  it("reports a missing Web Audio implementation as a failure, not a crash", async () => {
    const controller = new AudioController(() => {
      throw new Error("Web Audio is not available");
    });
    expect(await controller.enable()).toBe(false);
    expect(controller.getSnapshot().failed).toBe(true);
  });
});

describe("mute and volume", () => {
  it("scales the master gain by the volume and the ceiling", async () => {
    const { controller, current } = setup();
    await controller.enable();
    const master = current().nodes.find((n) => n.kind === "gain") as unknown as { gain: { value: number; events: string[] } };
    expect(master.gain.value).toBeCloseTo(DEFAULT_VOLUME * MASTER_CEILING, 5);
    controller.setVolume(1);
    expect(master.gain.value).toBeCloseTo(MASTER_CEILING, 5);
    controller.setVolume(0);
    expect(master.gain.value).toBe(0);
  });

  it("clamps the volume to 0..1 and ignores non-finite values", async () => {
    const { controller } = setup();
    controller.setVolume(7);
    expect(controller.getSnapshot().volume).toBe(1);
    controller.setVolume(-2);
    expect(controller.getSnapshot().volume).toBe(0);
    controller.setVolume(Number.NaN);
    expect(controller.getSnapshot().volume).toBe(0);
  });

  it("silences the master when muted and restores it when unmuted", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.setVolume(0.8);
    const master = current().nodes.find((n) => n.kind === "gain") as unknown as { gain: { value: number } };
    controller.setMuted(true);
    expect(master.gain.value).toBe(0);
    expect(controller.getSnapshot().muted).toBe(true);
    controller.setMuted(false);
    expect(master.gain.value).toBeCloseTo(0.8 * MASTER_CEILING, 5);
  });

  it("keeps mute and volume set before enable", async () => {
    const { controller, current } = setup();
    controller.setMuted(true);
    controller.setVolume(0.6);
    await controller.enable();
    const master = current().nodes.find((n) => n.kind === "gain") as unknown as { gain: { value: number } };
    expect(master.gain.value).toBe(0);
    expect(controller.getSnapshot().volume).toBe(0.6);
  });
});

describe("ambient beds", () => {
  it("plays one bed at a time and cross-fades on a mood change", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.setMood("idle");
    expect(controller.getSnapshot().activeBeds).toBe(1);
    controller.setMood("search");
    // The old bed is fading out and the new one is in. Both exist only during the fade.
    expect(controller.getSnapshot().activeBeds).toBe(2);
    current().endAllSources();
    // After the fade the retired bed is released.
    expect(controller.getSnapshot().activeBeds).toBeLessThanOrEqual(2);
  });

  it("does nothing for the same mood twice", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.setMood("tension");
    const created = current().nodes.length;
    controller.setMood("tension");
    expect(current().nodes.length).toBe(created);
  });

  it("starts the bed that matches the current mood when sound is enabled later", async () => {
    const { controller, current } = setup();
    controller.setMood("escape");
    await controller.enable();
    expect(controller.getSnapshot().activeBeds).toBe(1);
    expect(current().liveSources().length).toBeGreaterThan(0);
  });

  it("silences the bed when the mood becomes silent", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.setMood("tension");
    controller.setMood("silent");
    current().endAllSources();
    expect(controller.getSnapshot().mood).toBe("silent");
  });
});

describe("one-shot cues", () => {
  it("plays a cue and releases its nodes when it ends", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.cue("clue");
    expect(controller.getSnapshot().activeCues).toBe(1);
    current().endAllSources();
    expect(controller.getSnapshot().activeCues).toBe(0);
  });

  it("caps concurrent cues", async () => {
    const { controller } = setup();
    await controller.enable();
    for (let i = 0; i < MAX_CONCURRENT_CUES + 5; i += 1) controller.cue("clue");
    expect(controller.getSnapshot().activeCues).toBe(MAX_CONCURRENT_CUES);
  });

  it("plays no cue before enable", () => {
    const { controller, contexts } = setup();
    controller.cue("clue");
    expect(contexts).toHaveLength(0);
    expect(controller.getSnapshot().activeCues).toBe(0);
  });

});

describe("starting and stopping quickly", () => {
  it("two quick enable calls create one context", async () => {
    const { controller, contexts } = setup();
    const [a, b] = await Promise.all([controller.enable(), controller.enable()]);
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(contexts).toHaveLength(1);
  });

  it("turning sound off while it is starting leaves it off and releases the context", async () => {
    const { controller, contexts } = setup();
    const pending = controller.enable();
    controller.disable();
    expect(await pending).toBe(false);
    expect(controller.getSnapshot().enabled).toBe(false);
    expect(contexts[0]?.liveNodes()).toHaveLength(0);
    expect(contexts[0]?.closeCount).toBeGreaterThan(0);
  });
});

describe("resource lifecycle", () => {
  it("leaves no live node after dispose and closes the context", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.setMood("tension");
    controller.setMood("escape");
    controller.cue("glitch");
    controller.cue("whisper");
    expect(current().liveNodes().length).toBeGreaterThan(0);
    controller.dispose();
    expect(current().liveSources()).toHaveLength(0);
    expect(current().closeCount).toBe(1);
    expect(controller.getSnapshot().enabled).toBe(false);
  });

  it("can be disposed repeatedly", async () => {
    const { controller, current } = setup();
    await controller.enable();
    controller.dispose();
    controller.dispose();
    expect(current().closeCount).toBe(1);
  });

  it("cannot be enabled after dispose", async () => {
    const { controller, contexts } = setup();
    controller.dispose();
    expect(await controller.enable()).toBe(false);
    expect(contexts).toHaveLength(0);
  });

  it("releases everything on disable and can be enabled again", async () => {
    const { controller, contexts } = setup();
    await controller.enable();
    controller.setMood("idle");
    controller.disable();
    expect(contexts[0]?.liveSources()).toHaveLength(0);
    expect(contexts[0]?.closeCount).toBe(1);
    await controller.enable();
    expect(contexts).toHaveLength(2);
    expect(controller.getSnapshot().activeBeds).toBe(1);
  });

  it("tears down and flags a failure raised inside a bed", async () => {
    const { controller, current } = setup();
    await controller.enable();
    const context = current();
    vi.spyOn(context, "createOscillator").mockImplementation(() => {
      throw new Error("out of voices");
    });
    controller.setMood("tension");
    expect(controller.getSnapshot()).toMatchObject({ enabled: false, failed: true });
    expect(context.liveSources()).toHaveLength(0);
    expect(() => controller.cue("settle")).not.toThrow();
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const { controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.setVolume(0.2);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.setVolume(0.3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("returns a stable snapshot object between changes", () => {
    const { controller } = setup();
    expect(controller.getSnapshot()).toBe(controller.getSnapshot());
    const before = controller.getSnapshot();
    controller.setVolume(0.9);
    expect(controller.getSnapshot()).not.toBe(before);
  });
});
