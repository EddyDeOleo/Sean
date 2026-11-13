/**
 * Audio controller (Spec 3 section 10). Original synthesis with the Web Audio API. No audio file, no network, no asset.
 *
 * Lifecycle rules enforced here:
 * - No AudioContext exists until enable() is called, which the interface does from a user gesture (autoplay policy).
 * - Sound is off by default. enable() is the only way to start it. The on state is never persisted by this class.
 * - One ambient bed at a time. A mood change cross-fades to a new bed and stops the old one.
 * - One-shot cues are short envelopes. At most MAX_CONCURRENT_CUES play together, so cues cannot pile up.
 * - Every node a bed or cue creates is stopped and disconnected when it finishes or is replaced.
 * - dispose() stops everything and closes the context. It can be called repeatedly.
 * - Any failure inside audio is swallowed after cleanup. Audio never affects the investigation.
 *
 * The context is created through an injected factory, so tests drive the controller with a fake context.
 */

export type Mood = "silent" | "idle" | "search" | "tension" | "escape";
export type Cue =
  | "settle" | "glitch" | "whisper" | "clue" | "caught" | "door" | "escape"
  | "planchette" | "footstep" | "footstepRun" | "flashlight" | "growl" | "monsterStep";

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}

export interface GainLike extends AudioNodeLike {
  gain: ParamLike;
}

export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: ParamLike;
  detune: ParamLike;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

export interface FilterLike extends AudioNodeLike {
  type: string;
  frequency: ParamLike;
  Q: ParamLike;
}

export interface BufferSourceLike extends AudioNodeLike {
  buffer: unknown;
  loop: boolean;
  start(when?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

export interface CompressorLike extends AudioNodeLike {
  threshold: ParamLike;
  ratio: ParamLike;
  knee: ParamLike;
  attack: ParamLike;
  release: ParamLike;
}

export interface PannerLike extends AudioNodeLike {
  pan: ParamLike;
}

export interface AudioContextLike {
  /** Optional: without it, cues play centred. */
  createStereoPanner?(): PannerLike;
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainLike;
  createOscillator(): OscillatorLike;
  createBiquadFilter(): FilterLike;
  createBufferSource(): BufferSourceLike;
  createDynamicsCompressor(): CompressorLike;
  createBuffer(channels: number, length: number, sampleRate: number): { getChannelData(channel: number): Float32Array };
}

export type ContextFactory = () => AudioContextLike;

export const DEFAULT_VOLUME = 0.35;
/** The master gain ceiling. The slider value is scaled by this, so even full volume stays moderate. */
export const MASTER_CEILING = 0.5;
export const MAX_CONCURRENT_CUES = 6;
const FADE_SECONDS = 1.6;

export interface AudioSnapshot {
  enabled: boolean;
  muted: boolean;
  volume: number;
  ambient: number;
  effects: number;
  mood: Mood;
  failed: boolean;
  activeBeds: number;
  activeCues: number;
}

interface Bed {
  mood: Mood;
  gain: GainLike;
  /** Sources have stop(). Gain and filter nodes only disconnect. */
  nodes: { stop?: (when?: number) => void; disconnect(): void }[];
}

export function defaultContextFactory(): AudioContextLike {
  const Ctor: (new () => AudioContextLike) | undefined =
    (globalThis as unknown as { AudioContext?: new () => AudioContextLike }).AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: new () => AudioContextLike }).webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not available");
  return new Ctor();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export class AudioController {
  private context: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private compressor: CompressorLike | null = null;
  /** Ambient beds and one-shot effects have their own level, so the user can balance them. Both feed the master. */
  private ambientBus: GainLike | null = null;
  private effectsBus: GainLike | null = null;
  private ambientVolume = 1;
  private effectsVolume = 1;
  private tension = 0;
  private noiseBuffer: unknown = null;
  private starting: Promise<boolean> | null = null;
  private bed: Bed | null = null;
  private retiring: Bed[] = [];
  private cues = new Set<{ stop(): void }>();
  private enabled = false;
  private muted = false;
  private volume = DEFAULT_VOLUME;
  private mood: Mood = "silent";
  private failed = false;
  private disposed = false;
  private listeners = new Set<() => void>();
  private cachedSnapshot: AudioSnapshot | null = null;

  constructor(private readonly factory: ContextFactory = defaultContextFactory) {}

  // --- observable state -------------------------------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AudioSnapshot => {
    if (this.cachedSnapshot === null) {
      this.cachedSnapshot = {
        enabled: this.enabled,
        muted: this.muted,
        volume: this.volume,
        ambient: this.ambientVolume,
        effects: this.effectsVolume,
        mood: this.mood,
        failed: this.failed,
        activeBeds: (this.bed ? 1 : 0) + this.retiring.length,
        activeCues: this.cues.size,
      };
    }
    return this.cachedSnapshot;
  };

  private publish(): void {
    this.cachedSnapshot = null;
    for (const listener of [...this.listeners]) listener();
  }

  // --- controls ---------------------------------------------------------------------------------------------------

  /** Create the context. Must be called from a user gesture. Returns whether sound is now on. */
  enable(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.enabled) return Promise.resolve(true);
    // A second request while the first is still starting (a double click) shares it, so only one context is ever created.
    this.starting ??= this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async start(): Promise<boolean> {
    try {
      const context = this.factory();
      this.context = context;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 24;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.01;
      compressor.release.value = 0.3;
      const master = context.createGain();
      master.gain.value = this.effectiveGain();
      master.connect(compressor);
      compressor.connect(context.destination);
      const ambientBus = context.createGain();
      ambientBus.gain.value = this.ambientBusGain();
      ambientBus.connect(master);
      const effectsBus = context.createGain();
      effectsBus.gain.value = this.effectsVolume;
      effectsBus.connect(master);
      this.ambientBus = ambientBus;
      this.effectsBus = effectsBus;
      this.master = master;
      this.compressor = compressor;
      await context.resume();
      // Sound was turned off (or the controller disposed) while the context was starting.
      if (this.context !== context || this.disposed) return false;
      this.enabled = true;
      this.failed = false;
      this.publish();
      this.applyMood();
      return true;
    } catch {
      this.teardown();
      this.failed = true;
      this.publish();
      return false;
    }
  }

  /** Turn sound off and release everything. The user can enable it again. */
  disable(): void {
    this.teardown();
    this.enabled = false;
    this.publish();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateMaster();
    this.publish();
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    this.updateMaster();
    this.publish();
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = clamp01(volume);
    this.rampBus(this.ambientBus, this.ambientBusGain());
    this.publish();
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = clamp01(volume);
    this.rampBus(this.effectsBus, this.effectsVolume);
    this.publish();
  }

  /** How near the threat is, 0 to 1. The ambient bed swells with it. No-op until sound is enabled. */
  setTension(level: number): void {
    const next = clamp01(level);
    if (Math.abs(next - this.tension) < 0.02) return;
    this.tension = next;
    this.rampBus(this.ambientBus, this.ambientBusGain());
  }

  private ambientBusGain(): number {
    return this.ambientVolume * (1 + 0.7 * this.tension);
  }

  private rampBus(bus: GainLike | null, value: number): void {
    if (!this.context || !bus) return;
    try {
      const now = this.context.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(value, now + 0.25);
    } catch {
      this.fail();
    }
  }

  private effectiveGain(): number {
    return this.muted ? 0 : this.volume * MASTER_CEILING;
  }

  private updateMaster(): void {
    if (!this.context || !this.master) return;
    try {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(this.master.gain.value, now);
      this.master.gain.linearRampToValueAtTime(this.effectiveGain(), now + 0.08);
    } catch {
      this.fail();
    }
  }

  // --- moods and cues ---------------------------------------------------------------------------------------------

  /** Set the ambient mood. A mood change cross-fades. The same mood is a no-op. */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.publish();
    this.applyMood();
  }

  private applyMood(): void {
    if (!this.enabled || !this.context || !this.master) return;
    try {
      const context = this.context;
      const previous = this.bed;
      if (previous && previous.mood === this.mood) return;
      if (previous) this.retire(previous);
      this.bed = this.mood === "silent" ? null : this.buildBed(context, this.mood);
      this.publish();
    } catch {
      this.fail();
    }
  }

  private buildBed(context: AudioContextLike, mood: Exclude<Mood, "silent">): Bed {
    const bus = this.ambientBus as GainLike;
    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(this.bedLevel(mood), now + FADE_SECONDS);
    gain.connect(bus);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.bedBrightness(mood);
    filter.Q.value = 0.8;
    filter.connect(gain);

    const base = this.bedPitch(mood);
    const oscillators: OscillatorLike[] = [];
    for (const [ratio, detune] of [[1, -6], [1.5, 5], [0.5, 0]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = ratio === 0.5 ? "sine" : "triangle";
      oscillator.frequency.value = base * ratio;
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      oscillator.start(now);
      oscillators.push(oscillator);
    }

    // A slow wobble on the filter keeps the bed from sounding static.
    const wobble = context.createOscillator();
    wobble.type = "sine";
    wobble.frequency.value = mood === "tension" || mood === "escape" ? 0.35 : 0.12;
    const wobbleDepth = context.createGain();
    wobbleDepth.gain.value = this.bedBrightness(mood) * 0.35;
    wobble.connect(wobbleDepth);
    wobbleDepth.connect(filter.frequency as unknown as AudioNodeLike);
    wobble.start(now);

    const noise = this.noiseSource(context);
    const noiseGain = context.createGain();
    noiseGain.gain.value = mood === "escape" ? 0.06 : 0.025;
    noise.connect(noiseGain);
    noiseGain.connect(filter);
    noise.start(now);

    return {
      mood,
      gain,
      nodes: [...oscillators, wobble, noise, wobbleDepth, noiseGain, filter, gain],
    };
  }

  private bedLevel(mood: Mood): number {
    switch (mood) {
      case "tension":
      case "escape":
        return 0.5;
      default:
        return 0.32;
    }
  }

  private bedBrightness(mood: Mood): number {
    return mood === "tension" ? 520 : mood === "escape" ? 640 : 420;
  }

  private bedPitch(mood: Mood): number {
    switch (mood) {
      case "tension":
        return 49;
      case "escape":
        return 55;
      default:
        return 55;
    }
  }

  private noiseSource(context: AudioContextLike): BufferSourceLike {
    if (this.noiseBuffer === null) {
      const length = Math.floor(context.sampleRate * 2);
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      // A fixed pseudo-random sequence, so the sound is the same each time and tests are deterministic.
      let seed = 0x2545f491;
      for (let i = 0; i < data.length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    return source;
  }

  private retire(bed: Bed): void {
    const context = this.context;
    if (!context) return;
    this.retiring.push(bed);
    const now = context.currentTime;
    try {
      bed.gain.gain.cancelScheduledValues(now);
      bed.gain.gain.setValueAtTime(bed.gain.gain.value, now);
      bed.gain.gain.linearRampToValueAtTime(0.0001, now + FADE_SECONDS);
    } catch {
      // The fade is cosmetic. The nodes are still stopped below.
    }
    const finish = (): void => {
      this.stopBed(bed);
      this.retiring = this.retiring.filter((entry) => entry !== bed);
      this.publish();
    };
    // Stop the sources after the fade. A source's onended handler is the cleanup trigger when the context provides one.
    const sources = bed.nodes.filter((node): node is typeof node & { onended: (() => void) | null } => "onended" in node);
    for (const node of sources) {
      try {
        node.stop?.(now + FADE_SECONDS + 0.05);
      } catch {
        // Already stopped.
      }
    }
    const last = sources[sources.length - 1];
    if (last) last.onended = finish;
    else finish();
  }

  private stopBed(bed: Bed): void {
    for (const node of bed.nodes) {
      try {
        node.stop?.();
      } catch {
        // Not a source, or already stopped.
      }
      try {
        node.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  }

  /** Play one short cue. Nothing plays before sound has been enabled. */
  cue(cue: Cue, options: { pan?: number; gain?: number } = {}): void {
    if (!this.enabled || !this.context || !this.effectsBus) return;
    if (this.cues.size >= MAX_CONCURRENT_CUES) return;
    try {
      const context = this.context;
      const bus = this.effectsBus;
      const now = context.currentTime;
      const spec = this.cueSpec(cue);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(spec.level * clamp01(options.gain ?? 1), now + spec.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
      // A stereo position places a sound to the left or right of the listener. Without panner support it plays centred.
      const panner = options.pan !== undefined && context.createStereoPanner ? context.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.min(1, Math.max(-1, Number.isFinite(options.pan) ? (options.pan as number) : 0));
        panner.connect(bus);
        gain.connect(panner);
      } else {
        gain.connect(bus);
      }

      const filter = context.createBiquadFilter();
      filter.type = spec.filter;
      filter.frequency.value = spec.cutoff;
      filter.Q.value = 1.2;
      filter.connect(gain);

      const sources: { stop(when?: number): void; disconnect(): void; onended?: (() => void) | null }[] = [];
      for (const voice of spec.voices) {
        const oscillator = context.createOscillator();
        oscillator.type = voice.type;
        oscillator.frequency.setValueAtTime(voice.from, now);
        if (voice.to !== voice.from) oscillator.frequency.linearRampToValueAtTime(voice.to, now + spec.duration);
        oscillator.connect(filter);
        oscillator.start(now);
        oscillator.stop(now + spec.duration + 0.05);
        sources.push(oscillator);
      }
      if (spec.noise) {
        const noise = this.noiseSource(context);
        noise.loop = false;
        const noiseGain = context.createGain();
        noiseGain.gain.value = spec.noise;
        noise.connect(noiseGain);
        noiseGain.connect(filter);
        noise.start(now);
        noise.stop(now + spec.duration + 0.05);
        sources.push(noise);
        sources.push({ stop: () => undefined, disconnect: () => noiseGain.disconnect() });
      }
      sources.push({ stop: () => undefined, disconnect: () => filter.disconnect() });
      sources.push({ stop: () => undefined, disconnect: () => gain.disconnect() });
      if (panner) sources.push({ stop: () => undefined, disconnect: () => panner.disconnect() });

      const handle = {
        stop: (): void => {
          for (const source of sources) {
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
          this.cues.delete(handle);
          this.publish();
        },
      };
      this.cues.add(handle);
      const first = sources[0];
      if (first && "onended" in first) first.onended = handle.stop;
      this.publish();
    } catch {
      this.fail();
    }
  }

  private cueSpec(cue: Cue): {
    level: number;
    attack: number;
    duration: number;
    filter: "lowpass" | "bandpass" | "highpass";
    cutoff: number;
    noise: number;
    voices: { type: "sine" | "triangle" | "sawtooth" | "square"; from: number; to: number }[];
  } {
    switch (cue) {
      case "settle":
        return { level: 0.3, attack: 0.02, duration: 0.7, filter: "lowpass", cutoff: 500, noise: 0.05, voices: [{ type: "triangle", from: 82, to: 62 }] };
      case "glitch":
        return { level: 0.22, attack: 0.005, duration: 0.5, filter: "bandpass", cutoff: 900, noise: 0.35, voices: [{ type: "sawtooth", from: 180, to: 60 }] };
      case "whisper":
        return { level: 0.16, attack: 0.3, duration: 2.4, filter: "bandpass", cutoff: 2200, noise: 0.5, voices: [] };
      case "clue":
        return { level: 0.2, attack: 0.01, duration: 0.6, filter: "lowpass", cutoff: 2400, noise: 0, voices: [{ type: "sine", from: 523, to: 784 }] };
      case "caught":
        return { level: 0.3, attack: 0.01, duration: 0.9, filter: "lowpass", cutoff: 400, noise: 0.2, voices: [{ type: "sawtooth", from: 70, to: 40 }] };
      case "door":
        return { level: 0.22, attack: 0.02, duration: 1.0, filter: "lowpass", cutoff: 600, noise: 0.15, voices: [{ type: "square", from: 90, to: 120 }] };
      case "escape":
        return { level: 0.26, attack: 0.1, duration: 2.2, filter: "lowpass", cutoff: 1800, noise: 0, voices: [{ type: "sine", from: 262, to: 392 }, { type: "sine", from: 330, to: 494 }] };
      case "planchette":
        return { level: 0.14, attack: 0.03, duration: 0.55, filter: "lowpass", cutoff: 380, noise: 0.25, voices: [] };
      case "footstep":
        return { level: 0.12, attack: 0.005, duration: 0.16, filter: "lowpass", cutoff: 300, noise: 0.5, voices: [{ type: "sine", from: 70, to: 50 }] };
      case "footstepRun":
        return { level: 0.2, attack: 0.005, duration: 0.14, filter: "lowpass", cutoff: 420, noise: 0.6, voices: [{ type: "sine", from: 85, to: 55 }] };
      case "flashlight":
        return { level: 0.12, attack: 0.002, duration: 0.07, filter: "highpass", cutoff: 1800, noise: 0.4, voices: [{ type: "square", from: 1400, to: 900 }] };
      case "growl":
        return { level: 0.3, attack: 0.15, duration: 1.4, filter: "lowpass", cutoff: 360, noise: 0.18, voices: [{ type: "sawtooth", from: 62, to: 44 }, { type: "sawtooth", from: 66, to: 47 }] };
      case "monsterStep":
        return { level: 0.22, attack: 0.005, duration: 0.2, filter: "lowpass", cutoff: 220, noise: 0.4, voices: [{ type: "sine", from: 48, to: 34 }] };
    }
  }

  // --- teardown ---------------------------------------------------------------------------------------------------

  private fail(): void {
    this.teardown();
    this.enabled = false;
    this.failed = true;
    this.publish();
  }

  private teardown(): void {
    for (const handle of [...this.cues]) handle.stop();
    this.cues.clear();
    if (this.bed) this.stopBed(this.bed);
    for (const bed of this.retiring) this.stopBed(bed);
    this.bed = null;
    this.retiring = [];
    try {
      this.ambientBus?.disconnect();
      this.effectsBus?.disconnect();
      this.master?.disconnect();
      this.compressor?.disconnect();
    } catch {
      // Already disconnected.
    }
    const context = this.context;
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.ambientBus = null;
    this.effectsBus = null;
    this.noiseBuffer = null;
    this.tension = 0;
    if (context && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  /** Stop everything and close the context. Safe to call more than once. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teardown();
    this.enabled = false;
    this.listeners.clear();
    this.cachedSnapshot = null;
  }
}
