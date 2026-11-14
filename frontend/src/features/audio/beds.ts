/**
 * The Ouija room bed: a quiet room tone, a low wood resonance, a faint candle crackle and a distant creak that comes and
 * goes. Everything loops, so the bed runs until it is retired. Built only from shared noise, one cached crackle buffer and
 * a few oscillators.
 */

import type { AudioContextLike, BufferSourceLike, GainLike } from "./AudioController";
import { mulberry32, modulate } from "./synth";

/** Seconds of crackle in the looping buffer. A prime-ish length keeps it from lining up with the 2 s noise loop. */
export const CRACKLE_SECONDS = 5.3;
/** The crackle buffer is stored at a lower rate (the browser resamples it), which keeps it small. */
export const CRACKLE_RATE = 22050;

/** Sparse clicks of a few milliseconds each, in a fixed pseudo-random pattern. */
export function makeCrackleBuffer(context: AudioContextLike): { getChannelData(channel: number): Float32Array } {
  const length = Math.floor(CRACKLE_SECONDS * CRACKLE_RATE);
  const buffer = context.createBuffer(1, length, CRACKLE_RATE);
  const data = buffer.getChannelData(0);
  const rng = mulberry32(0x0c4d1e);
  let at = Math.floor(rng() * 0.3 * CRACKLE_RATE);
  while (at < length - 200) {
    const size = Math.floor(CRACKLE_RATE * (0.0015 + rng() * 0.004));
    const amp = 0.25 + rng() * 0.75;
    for (let i = 0; i < size && at + i < length; i += 1) {
      data[at + i] = (rng() * 2 - 1) * amp * Math.exp((-4 * i) / size);
    }
    // Mostly single pops, sometimes two close together. The gaps are 0.1 to 1.2 seconds.
    const close = rng() < 0.3;
    at += Math.floor(CRACKLE_RATE * (close ? 0.02 + rng() * 0.05 : 0.1 + rng() * 1.1));
  }
  return buffer;
}

type BedNode = { stop?: (when?: number) => void; disconnect(): void };

interface BedSources {
  noise(): BufferSourceLike;
  crackle(): BufferSourceLike;
}

/** Build the bed and connect it to `out`. Returns every node, so the controller can stop and disconnect them. */
export function buildOuijaBed(context: AudioContextLike, sources: BedSources, out: GainLike, now: number): BedNode[] {
  const nodes: BedNode[] = [];
  const own = <T extends BedNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const noiseAt = (offset: number): BufferSourceLike => {
    const node = own(sources.noise());
    node.start(now, offset);
    return node;
  };
  const gain = (value: number): GainLike => {
    const node = own(context.createGain());
    node.gain.value = value;
    return node;
  };
  const filter = (type: string, frequency: number, q: number) => {
    const node = own(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  const osc = (frequency: number, type = "sine") => {
    const node = own(context.createOscillator());
    node.type = type;
    node.frequency.value = frequency;
    node.start(now);
    return node;
  };

  // Room tone: soft low-passed noise.
  const room = noiseAt(0.3);
  const roomFilter = filter("lowpass", 520, 0.5);
  const roomGain = gain(0.05);
  room.connect(roomFilter);
  roomFilter.connect(roomGain);
  roomGain.connect(out);

  // Wood resonance: narrow bands of noise ring like old furniture, plus two slow low tones that drift in level.
  for (const [frequency, q, level, offset] of [[165, 14, 0.5, 1.1], [245, 10, 0.3, 1.6]] as const) {
    const source = noiseAt(offset);
    const band = filter("bandpass", frequency, q);
    const bandGain = gain(level);
    source.connect(band);
    band.connect(bandGain);
    bandGain.connect(out);
  }
  for (const [frequency, drift, level] of [[57, 0.07, 0.03], [87.5, 0.11, 0.02]] as const) {
    const tone = osc(frequency);
    const toneGain = gain(level);
    const lfo = osc(drift);
    const lfoDepth = gain(level * 0.7);
    lfo.connect(lfoDepth);
    modulate(lfoDepth, toneGain.gain);
    tone.connect(toneGain);
    toneGain.connect(out);
  }

  // Candle crackle: clicks from the cached buffer, high-passed so only the pops remain.
  const crackle = own(sources.crackle());
  crackle.start(now);
  const crackleFilter = filter("highpass", 1800, 0.7);
  const crackleGain = gain(0.12);
  crackle.connect(crackleFilter);
  crackleFilter.connect(crackleGain);
  crackleGain.connect(out);

  // A distant creak: a slow, quiet, pitch-wandering saw through a narrow band. Its level rises and falls very slowly.
  const creak = osc(118, "sawtooth");
  const creakWander = osc(0.13);
  const wanderDepth = gain(380);
  creakWander.connect(wanderDepth);
  modulate(wanderDepth, creak.detune);
  const creakBand = filter("bandpass", 720, 7);
  const creakGain = gain(0.012);
  const creakSwell = osc(0.045);
  const swellDepth = gain(0.011);
  creakSwell.connect(swellDepth);
  modulate(swellDepth, creakGain.gain);
  creak.connect(creakBand);
  creakBand.connect(creakGain);
  creakGain.connect(out);

  return nodes;
}
