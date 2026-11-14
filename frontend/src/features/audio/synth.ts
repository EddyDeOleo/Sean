/**
 * Small helpers shared by the procedural cues and beds: a deterministic random generator, envelope scheduling, and a Rig
 * that records every node a cue creates so the controller can stop and disconnect all of them.
 *
 * Nothing here touches the network or a file. Only types are imported from the controller, so there is no import cycle.
 */

import type {
  AudioContextLike,
  AudioNodeLike,
  BufferSourceLike,
  FilterLike,
  GainLike,
  OscillatorLike,
  ParamLike,
  WaveShaperLike,
} from "./AudioController";

/** The smallest gain an exponential ramp may use. */
export const FLOOR = 0.0001;

/** A small, fast, seedable generator (mulberry32). The same seed always gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string, used to seed a cue from its name. */
export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Schedule a decaying envelope: the gain jumps to FLOOR at `t`, rises to `peak` over `rise` seconds, then falls
 * exponentially to FLOOR at `t + decay`.
 */
export function strike(param: ParamLike, t: number, peak: number, decay: number, rise = 0.0012): void {
  param.setValueAtTime(FLOOR, t);
  param.linearRampToValueAtTime(Math.max(peak, FLOOR), t + rise);
  param.exponentialRampToValueAtTime(FLOOR, t + decay);
}

export type Connectable = { connect(destination: unknown): unknown };

/** Connect nodes in a row, a to b to c. */
export function chain(...nodes: Connectable[]): void {
  for (let i = 0; i < nodes.length - 1; i += 1) nodes[i]!.connect(nodes[i + 1]);
}

/** Drive an AudioParam from a node (an LFO). */
export function modulate(source: Connectable, param: ParamLike): void {
  source.connect(param as unknown as AudioNodeLike);
}

interface RigSource {
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
  disconnect(): void;
}

/**
 * Owns the nodes of one cue. Sources start at `t0` and stop at `end`, so nothing outlives the cue. `release()` stops and
 * disconnects everything and may be called more than once.
 */
export class Rig {
  readonly sources: RigSource[] = [];
  readonly others: { disconnect(): void }[] = [];

  constructor(
    readonly ctx: AudioContextLike,
    private readonly noise: () => BufferSourceLike,
    readonly t0: number,
    readonly end: number,
    private readonly curve: () => Float32Array,
  ) {}

  gain(value = 1): GainLike {
    const node = this.ctx.createGain();
    node.gain.value = value;
    this.others.push(node);
    return node;
  }

  filter(type: "lowpass" | "highpass" | "bandpass" | "peaking", frequency: number, q = 1): FilterLike {
    const node = this.ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    this.others.push(node);
    return node;
  }

  osc(type: "sine" | "triangle" | "sawtooth" | "square", frequency: number): OscillatorLike {
    const node = this.ctx.createOscillator();
    node.type = type;
    node.frequency.value = frequency;
    node.start(this.t0);
    node.stop(this.end);
    this.sources.push(node);
    return node;
  }

  /** Looping noise from the shared buffer. `offset` (seconds) decorrelates sources that use the same buffer. */
  noiseSrc(offset = 0): BufferSourceLike {
    const node = this.noise();
    node.loop = true;
    node.start(this.t0, offset);
    node.stop(this.end);
    this.sources.push(node);
    return node;
  }

  /** A distortion stage, or null when the context has no WaveShaper. */
  shaper(): WaveShaperLike | null {
    const node = this.ctx.createWaveShaper?.() ?? null;
    if (!node) return null;
    node.curve = this.curve();
    node.oversample = "2x";
    this.others.push(node);
    return node;
  }

  /** Adopt a node made elsewhere (for example a panner), so it is disconnected with the rest. */
  adopt(node: { disconnect(): void }): void {
    this.others.push(node);
  }

  release(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    for (const node of this.others) {
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  }
}

/** The most the final limiter lets through, as a linear level: 0.7 is about -3.1 dBFS. */
export const LIMITER_CEILING = 0.7;

/**
 * A transparent-then-soft limiter curve: close to a straight line for quiet signals, bending toward the ceiling for loud
 * ones, and never above it. The WaveShaper clamps its input to -1..1, so the output is bounded by the curve's end values.
 */
export function makeLimiterCurve(points = 2049): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = LIMITER_CEILING * Math.tanh(x / LIMITER_CEILING);
  }
  return curve;
}

/** A tanh-shaped soft-clip curve. Output is always within -1..1. */
export function makeDistortionCurve(points = 1024, drive = 3): Float32Array {
  const curve = new Float32Array(points);
  const norm = Math.tanh(drive);
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}
