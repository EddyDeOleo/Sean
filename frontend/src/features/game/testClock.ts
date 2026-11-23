/**
 * Deterministic test clock for the browser tests (development builds only).
 *
 * Normally the game steps with the wall clock, and the monster's behaviour depends on frame timing. In a development build
 * opened with `?testClock=1&seed=<n>`, the game does not step itself. A test drives it one fixed step at a time through
 * `window.__seanTest.advance`, with an explicit input, so the same seed and the same inputs always produce the same run.
 *
 * Nothing here changes the game's rules. The same `step` function runs; only the clock and the input source differ. Production
 * builds never read these parameters (`import.meta.env.DEV` is false), and the production code path is unchanged.
 */
import type { Input } from "./world";


/** One simulation step of a test run. Constant, so a run does not depend on the wall clock. */
export const FIXED_STEP = 1 / 60;

export interface TestClockSettings {
  /** The seed of the first attempt. Each retry adds its attempt number minus one, so retries differ and stay reproducible. */
  seed: number;
}

/** The input a test sends for a step. Same shape as the game's own input. */
/** The input a test sends for a step: the game's own input, plus the hiding action (the E key) for this step. */
export type TestInput = Input & { interact?: boolean };

/** What a test reads after each advance: the state after the steps, and the events those steps produced. */
export interface TestFrameState {
  time: number;
  status: string;
  monster: string;
  monsterAt: [number, number];
  /** The creature's facing in radians. It decides what the creature can see. */
  monsterYaw: number;
  flashlight: boolean;
  /** The cinematic phase of the frame drawn last (null outside the caught state). Derived from the simulation time. */
  cinematicPhase: string | null;
  /** Seconds since the catch, as the last drawn frame measured them. Null outside the catch. */
  cinematicElapsed: number | null;
  /** Whether a hiding place is in reach (the game's on-screen hint). */
  canHide: boolean;
  player: [number, number];
  yaw: number;
  collected: number;
  /** Each clue: its position and whether it is collected. Fixed by the level and the evidence count. */
  clues: Array<[number, number, boolean]>;
  gateOpen: boolean;
  hidden: boolean;
  moving: boolean;
  sprinting: boolean;
  noiseAt: [number, number] | null;
  /** Events produced during this advance, as "TYPE" or "TYPE:detail". */
  events: string[];
}

export interface TestClockApi {
  /**
   * Advances the simulation by `frames` fixed steps, then (if `render`) draws one frame. `renderSeconds` sets the time the
   * drawn frame advances the caught cinematic by; by default it is one fixed step. Used to capture exact cinematic phases.
   */
  advance(input: TestInput, frames: number, render: boolean, renderSeconds?: number): TestFrameState;
}

declare global {
  interface Window {
    __seanTest?: TestClockApi;
  }
}

/** The test clock's settings, or null when the page was not opened with the test clock (always null in production). */
export function testClockSettings(search: string = typeof window !== "undefined" ? window.location.search : ""): TestClockSettings | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(search);
  if (params.get("testClock") !== "1") return null;
  const seed = Number(params.get("seed") ?? "1");
  if (!Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647) throw new Error("testClock: seed must be an integer from 0 to 2147483647");
  return { seed };
}

/** The world seed for an attempt: the normal rule (the attempt number) unless the test clock fixes the seed. */
export function worldSeed(attempt: number, settings: TestClockSettings | null): number {
  return settings ? settings.seed + attempt - 1 : attempt;
}
