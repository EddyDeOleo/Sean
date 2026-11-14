/**
 * Renders the real AudioController in Edge through an OfflineAudioContext. The page loads the real source modules from the
 * Vite dev server. A small adapter makes the offline context look like the AudioContextLike the controller expects, with a
 * clock the harness moves to schedule each cue at a chosen time.
 */

import type { Page } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Cue, Mood } from "../../src/features/audio/AudioController";
import type { Rendered } from "./analysis";

export const SAMPLE_RATE = 44100;
export const OUTPUT_DIR = join(process.env.TEMP ?? tmpdir(), "sean-audio");

export interface Scenario {
  seconds: number;
  /** Master volume, ambient and effects levels. The default is the worst case, 1. */
  volume?: number;
  ambient?: number;
  effects?: number;
  intenseAllowed?: boolean;
  /** Whether the context offers createWaveShaper. Default true. */
  waveShaper?: boolean;
  /** Set a mood at the start. */
  mood?: Mood;
  events?: { at: number; cue: Cue; options?: { pan?: number; gain?: number; priority?: boolean } }[];
  tension?: { at: number; level: number }[];
}

export interface RenderResult extends Rendered {
  /** Controller snapshot counts after the render finished, and after dispose. */
  activeCuesAfter: number;
  activeBedsAfter: number;
  /** After dispose(): nothing may remain. */
  activeCuesDisposed: number;
  activeBedsDisposed: number;
  failed: boolean;
  intenseAllowed: boolean;
  /** How many nodes the context created. */
  nodesCreated: number;
  cuesDurationSeconds: Record<string, number>;
}

/** Runs in the page. Kept free of imports from this file, because Playwright serialises it. */
async function renderInPage(scenario: Scenario & { sampleRate: number }): Promise<{
  left: string;
  right: string;
  activeCuesAfter: number;
  activeBedsAfter: number;
  activeCuesDisposed: number;
  activeBedsDisposed: number;
  failed: boolean;
  intenseAllowed: boolean;
  nodesCreated: number;
  cuesDurationSeconds: Record<string, number>;
}> {
  const path = "/src/features/audio/AudioController.ts";
  const { AudioController, cueDurationSeconds } = (await import(/* @vite-ignore */ path)) as {
    AudioController: new (factory: () => unknown) => {
      enable(): Promise<boolean>;
      setVolume(v: number): void;
      setAmbientVolume(v: number): void;
      setEffectsVolume(v: number): void;
      setIntenseAllowed(v: boolean): void;
      setMood(m: string): void;
      setTension(v: number): void;
      cue(c: string, o?: unknown): void;
      getSnapshot(): { activeCues: number; activeBeds: number; failed: boolean; intenseAllowed: boolean };
      dispose(): void;
    };
    cueDurationSeconds: (cue: string) => number;
  };
  const sampleRate = scenario.sampleRate;
  const context = new OfflineAudioContext(2, Math.ceil(sampleRate * scenario.seconds), sampleRate);
  let clock = 0;
  let nodesCreated = 0;
  const count = <T,>(node: T): T => {
    nodesCreated += 1;
    return node;
  };
  const adapter: Record<string, unknown> = {
    get currentTime() {
      return clock;
    },
    sampleRate,
    state: "running",
    destination: context.destination,
    resume: async () => undefined,
    close: async () => undefined,
    createGain: () => count(context.createGain()),
    createOscillator: () => count(context.createOscillator()),
    createBiquadFilter: () => count(context.createBiquadFilter()),
    createBufferSource: () => count(context.createBufferSource()),
    createDynamicsCompressor: () => count(context.createDynamicsCompressor()),
    createStereoPanner: () => count(context.createStereoPanner()),
    createBuffer: (channels: number, length: number, rate: number) => context.createBuffer(channels, length, rate),
  };
  if (scenario.waveShaper !== false) adapter.createWaveShaper = () => count(context.createWaveShaper());

  const controller = new AudioController(() => adapter);
  // Volumes are set before enable, so the master gain is already at its final value at time zero.
  controller.setVolume(scenario.volume ?? 1);
  controller.setAmbientVolume(scenario.ambient ?? 1);
  controller.setEffectsVolume(scenario.effects ?? 1);
  controller.setIntenseAllowed(scenario.intenseAllowed ?? true);
  await controller.enable();
  if (scenario.mood) controller.setMood(scenario.mood);
  for (const level of scenario.tension ?? []) {
    clock = level.at;
    controller.setTension(level.level);
  }
  const names = new Set<string>();
  for (const event of scenario.events ?? []) {
    clock = event.at;
    controller.cue(event.cue, event.options);
    names.add(event.cue);
  }
  const cuesDurationSeconds: Record<string, number> = {};
  for (const name of names) cuesDurationSeconds[name] = cueDurationSeconds(name);

  const buffer = await context.startRendering();
  // The browser reports the end of each source after rendering. Give those events a moment.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const snapshot = controller.getSnapshot();
  const encode = (data: Float32Array): string => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  };
  const result = {
    left: encode(buffer.getChannelData(0)),
    right: encode(buffer.getChannelData(1)),
    activeCuesAfter: snapshot.activeCues,
    activeBedsAfter: snapshot.activeBeds,
    activeCuesDisposed: 0,
    activeBedsDisposed: 0,
    failed: snapshot.failed,
    intenseAllowed: snapshot.intenseAllowed,
    nodesCreated,
    cuesDurationSeconds,
  };
  controller.dispose();
  const after = controller.getSnapshot();
  result.activeCuesDisposed = after.activeCues;
  result.activeBedsDisposed = after.activeBeds;
  return result;
}

function decode(text: string): Float32Array {
  const buffer = Buffer.from(text, "base64");
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return new Float32Array(copy.buffer);
}

export async function render(page: Page, scenario: Scenario): Promise<RenderResult> {
  const raw = await page.evaluate(renderInPage, { ...scenario, sampleRate: SAMPLE_RATE });
  return { ...raw, sampleRate: SAMPLE_RATE, left: decode(raw.left), right: decode(raw.right) };
}

/** A scenario for one cue played at 0.25 s, long enough to hold its whole tail. */
export function singleCue(cue: Cue, seconds: number, options?: { pan?: number; gain?: number; priority?: boolean }): Scenario {
  return { seconds, events: [{ at: 0.25, cue, options }] };
}
