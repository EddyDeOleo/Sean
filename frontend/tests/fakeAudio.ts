/**
 * A fake Web Audio context that records every node it creates and whether it is still live.
 *
 * "Live" means: created, not stopped (for sources), and not disconnected. After a controller is disposed, no node may be
 * live and the context must be closed. That is how the tests prove there are no leaked resources.
 */

import type {
  AudioContextLike,
  BufferSourceLike,
  CompressorLike,
  FilterLike,
  GainLike,
  OscillatorLike,
  ParamLike,
} from "../src/features/audio/AudioController";

export class FakeParam implements ParamLike {
  value = 0;
  events: string[] = [];
  setValueAtTime(value: number): FakeParam {
    this.value = value;
    this.events.push(`set:${value}`);
    return this;
  }
  linearRampToValueAtTime(value: number): FakeParam {
    this.value = value;
    this.events.push(`ramp:${value}`);
    return this;
  }
  exponentialRampToValueAtTime(value: number): FakeParam {
    this.value = value;
    this.events.push(`exp:${value}`);
    return this;
  }
  cancelScheduledValues(): FakeParam {
    this.events.push("cancel");
    return this;
  }
}

export class FakeNode {
  connected = false;
  disconnected = false;
  stopped = false;
  started = false;
  onended: (() => void) | null = null;
  readonly kind: string;
  constructor(kind: string, readonly owner: FakeContext) {
    this.kind = kind;
    owner.nodes.push(this);
  }
  connect(destination: unknown): unknown {
    this.connected = true;
    return destination;
  }
  disconnect(): void {
    this.disconnected = true;
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    this.stopped = true;
  }
  /** Simulate the browser finishing playback of a source. */
  end(): void {
    this.stopped = true;
    this.onended?.();
  }
  get live(): boolean {
    const isSource = this.kind === "oscillator" || this.kind === "buffersource";
    if (isSource) return this.started && !this.stopped;
    return this.connected && !this.disconnected;
  }
}

class FakeGain extends FakeNode implements GainLike {
  gain = new FakeParam();
  constructor(owner: FakeContext) {
    super("gain", owner);
    this.gain.value = 1;
  }
}

class FakeOscillator extends FakeNode implements OscillatorLike {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
  constructor(owner: FakeContext) {
    super("oscillator", owner);
  }
}

class FakeFilter extends FakeNode implements FilterLike {
  type = "lowpass";
  frequency = new FakeParam();
  Q = new FakeParam();
  constructor(owner: FakeContext) {
    super("filter", owner);
  }
}

class FakeBufferSource extends FakeNode implements BufferSourceLike {
  buffer: unknown = null;
  loop = false;
  constructor(owner: FakeContext) {
    super("buffersource", owner);
  }
}

class FakeCompressor extends FakeNode implements CompressorLike {
  threshold = new FakeParam();
  ratio = new FakeParam();
  knee = new FakeParam();
  attack = new FakeParam();
  release = new FakeParam();
  constructor(owner: FakeContext) {
    super("compressor", owner);
  }
}

export class FakeContext implements AudioContextLike {
  nodes: FakeNode[] = [];
  state = "suspended";
  closeCount = 0;
  resumeCount = 0;
  currentTime = 0;
  sampleRate = 8000;
  destination = { kind: "destination" };
  resumeError: Error | null = null;

  async resume(): Promise<void> {
    this.resumeCount += 1;
    if (this.resumeError) throw this.resumeError;
    this.state = "running";
  }
  async close(): Promise<void> {
    this.closeCount += 1;
    this.state = "closed";
  }
  createGain(): GainLike {
    return new FakeGain(this);
  }
  createOscillator(): OscillatorLike {
    return new FakeOscillator(this);
  }
  createBiquadFilter(): FilterLike {
    return new FakeFilter(this);
  }
  createBufferSource(): BufferSourceLike {
    return new FakeBufferSource(this);
  }
  createDynamicsCompressor(): CompressorLike {
    return new FakeCompressor(this);
  }
  createBuffer(_channels: number, length: number): { getChannelData(channel: number): Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }

  liveSources(): FakeNode[] {
    return this.nodes.filter((node) => (node.kind === "oscillator" || node.kind === "buffersource") && node.live);
  }
  liveNodes(): FakeNode[] {
    return this.nodes.filter((node) => node.live);
  }
  /** Finish every source, as the browser does once a scheduled stop time passes. */
  endAllSources(): void {
    for (const node of this.nodes) if (node.kind === "oscillator" || node.kind === "buffersource") node.end();
  }
}
