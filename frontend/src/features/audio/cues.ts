/**
 * Procedural cues. Every sound is built from oscillators and shared looping noise, with envelopes and filter sweeps
 * scheduled up front, so nothing needs a timer and every node stops at the end of the cue.
 *
 * Wood is modelled with modal synthesis: a struck piece of wood rings at a few inharmonic frequencies that each decay on
 * their own, and a very short band-passed noise click stands in for the contact. Friction is band-passed noise whose
 * centre frequency and level drift irregularly, with sparse stick-slip pulses. A creak is a pitch-sliding sawtooth with
 * rough amplitude modulation and two resonant formant filters.
 *
 * The measured results of these cues are in docs/development/audio-asset-manifest.md.
 */

import type { GainLike } from "./AudioController";
import { FLOOR, Rig, chain, modulate, strike } from "./synth";

export interface Variation {
  /** Deterministic random numbers in 0..1, seeded by the cue name and how many times it has played. */
  rng: () => number;
  /** The softened variant, used when intense cues are not allowed. */
  soft: boolean;
}

export interface CueDef {
  /** Seconds. Every source stops at this time, so a cue never runs longer. */
  duration: number;
  /** The output level before the effects bus. */
  level: number;
  build(rig: Rig, out: GainLike, v: Variation): void;
}

interface ModalPartial {
  ratio: number;
  amp: number;
  /** Seconds for the partial to fall to silence. */
  decay: number;
}

/** One ringing body: sine partials at inharmonic ratios, each struck at the given times. */
function modal(rig: Rig, out: GainLike, f0: number, partials: ModalPartial[], hits: { t: number; amp: number }[]): void {
  for (const p of partials) {
    const osc = rig.osc("sine", f0 * p.ratio);
    const gain = rig.gain(FLOOR);
    for (const hit of hits) strike(gain.gain, hit.t, p.amp * hit.amp, p.decay);
    chain(osc, gain, out);
  }
}

/** A very short filtered-noise click, the contact transient of an impact. */
function clickNoise(rig: Rig, out: GainLike, at: number, type: "bandpass" | "lowpass", frequency: number, q: number, peak: number, decay: number, offset: number): void {
  const noise = rig.noiseSrc(offset);
  const filter = rig.filter(type, frequency, q);
  const gain = rig.gain(FLOOR);
  strike(gain.gain, at, peak, decay, 0.0006);
  chain(noise, filter, gain, out);
}

/** A slow irregular signal in about -1..1: three sines with random rates and phases. */
function wobble(rng: () => number, base = 1): (t: number) => number {
  const phase = [rng() * 6.283, rng() * 6.283, rng() * 6.283];
  const rate = [(0.8 + rng() * 0.5) * base, (2.1 + rng() * 0.9) * base, (4.3 + rng() * 1.7) * base];
  return (t) =>
    Math.sin(t * rate[0]! * 6.283 + phase[0]!) * 0.5 +
    Math.sin(t * rate[1]! * 6.283 + phase[1]!) * 0.3 +
    Math.sin(t * rate[2]! * 6.283 + phase[2]!) * 0.2;
}

const jitter = (rng: () => number, amount: number): number => 1 + (rng() - 0.5) * 2 * amount;

// --- wood impacts -----------------------------------------------------------------------------------------------------

const KNOCK: ModalPartial[] = [
  { ratio: 1, amp: 1, decay: 0.5 },
  { ratio: 2.27, amp: 0.62, decay: 0.34 },
  { ratio: 3.93, amp: 0.38, decay: 0.22 },
  { ratio: 5.61, amp: 0.2, decay: 0.14 },
];

const woodKnock: CueDef = {
  duration: 0.6,
  level: 0.42,
  build(rig, out, v) {
    const t = rig.t0;
    modal(rig, out, 250 * jitter(v.rng, 0.08), KNOCK, [{ t, amp: 1 }]);
    clickNoise(rig, out, t, "bandpass", 2600, 1.2, 1.8, 0.012, 0.4);
  },
};

const THUD: ModalPartial[] = [
  { ratio: 1, amp: 1, decay: 0.62 },
  { ratio: 2.1, amp: 0.6, decay: 0.4 },
  { ratio: 3.3, amp: 0.34, decay: 0.26 },
  { ratio: 4.7, amp: 0.18, decay: 0.16 },
];

const woodThud: CueDef = {
  duration: 0.75,
  level: 0.42,
  build(rig, out, v) {
    const t = rig.t0;
    modal(rig, out, 160 * jitter(v.rng, 0.06), THUD, [{ t, amp: 1 }]);
    // The board's body: a low thump that drops a little in pitch.
    const body = rig.osc("sine", 96);
    body.frequency.setValueAtTime(110, t);
    body.frequency.exponentialRampToValueAtTime(72, t + 0.12);
    const bodyGain = rig.gain(FLOOR);
    strike(bodyGain.gain, t, 0.55, 0.3);
    chain(body, bodyGain, out);
    clickNoise(rig, out, t, "bandpass", 2000, 0.8, 1.4, 0.02, 0.9);
  },
};

// --- planchette contact and friction ------------------------------------------------------------------------------------

const TICK: ModalPartial[] = [{ ratio: 1, amp: 0.5, decay: 0.07 }];

const planchetteTick: CueDef = {
  duration: 0.2,
  level: 0.45,
  build(rig, out, v) {
    const t = rig.t0;
    // Felt on wood: a soft grainy tick, then a short thump as the planchette's weight settles.
    clickNoise(rig, out, t, "bandpass", 2400, 1.4, 0.55, 0.01, 0.7);
    clickNoise(rig, out, t + 0.013, "bandpass", 3800, 1.4, 0.2, 0.006, 1.5);
    const thump = rig.osc("sine", 125 * jitter(v.rng, 0.05));
    thump.frequency.setValueAtTime(130, t + 0.004);
    thump.frequency.exponentialRampToValueAtTime(82, t + 0.07);
    const thumpGain = rig.gain(FLOOR);
    strike(thumpGain.gain, t + 0.004, 0.5, 0.085, 0.003);
    chain(thump, thumpGain, out);
    modal(rig, out, 390, TICK, [{ t: t + 0.003, amp: 1 }]);
  },
};

const planchetteSlide: CueDef = {
  duration: 1,
  level: 0.5,
  build(rig, out, v) {
    const t0 = rig.t0;
    const length = rig.end - rig.t0;
    const slow = wobble(v.rng);
    const slower = wobble(v.rng, 0.6);
    const bright = rig.noiseSrc(0.2);
    const body = rig.noiseSrc(1.3);
    const bandA = rig.filter("bandpass", 1900, 0.8);
    const bandB = rig.filter("bandpass", 650, 1.4);
    const gainA = rig.gain(FLOOR);
    const gainB = rig.gain(FLOOR);
    chain(bright, bandA, gainA, out);
    chain(body, bandB, gainB, out);
    bandA.frequency.setValueAtTime(1900, t0);
    bandB.frequency.setValueAtTime(650, t0);
    gainA.gain.setValueAtTime(FLOOR, t0);
    gainB.gain.setValueAtTime(FLOOR, t0);
    const dt = 0.02;
    for (let t = dt; t < length - 0.02; t += dt) {
      const x = t / length;
      const shape = Math.min(1, x / 0.12) * Math.min(1, (1 - x) / 0.2);
      const level = Math.max(FLOOR, shape * (0.6 + 0.4 * slow(t)));
      bandA.frequency.linearRampToValueAtTime(1900 * (1 + 0.35 * slower(t)), t0 + t);
      bandB.frequency.linearRampToValueAtTime(650 * (1 + 0.25 * slower(t + 3)), t0 + t);
      gainA.gain.linearRampToValueAtTime(level * 0.8, t0 + t);
      gainB.gain.linearRampToValueAtTime(level * 0.9, t0 + t);
      // A micro stick-slip: the planchette catches and lets go within a few milliseconds.
      if (shape > 0.3 && v.rng() < 0.16) {
        gainA.gain.linearRampToValueAtTime(level * 1.9, t0 + t + 0.004);
        gainA.gain.linearRampToValueAtTime(level * 0.35, t0 + t + 0.011);
      }
    }
    gainA.gain.linearRampToValueAtTime(FLOOR, t0 + length - 0.01);
    gainB.gain.linearRampToValueAtTime(FLOOR, t0 + length - 0.01);
  },
};

// --- creaks --------------------------------------------------------------------------------------------------------------

const woodCreak: CueDef = {
  duration: 0.9,
  level: 0.9,
  build(rig, out, v) {
    const t0 = rig.t0;
    const length = rig.end - rig.t0;
    const carrier = rig.osc("sawtooth", 160);
    // Rough amplitude modulation: the gain swings between 0 and 1 at about 40 Hz.
    const rough = rig.gain(0.5);
    const lfo = rig.osc("sawtooth", 34 + v.rng() * 10);
    const depth = rig.gain(0.5);
    chain(lfo, depth);
    modulate(depth, rough.gain);
    chain(carrier, rough);

    const formantOne = rig.filter("bandpass", 800, 9);
    const formantTwo = rig.filter("bandpass", 1650, 11);
    const gainOne = rig.gain(1.2);
    const gainTwo = rig.gain(0.8);
    const env = rig.gain(FLOOR);
    chain(rough, formantOne, gainOne, env);
    chain(rough, formantTwo, gainTwo, env);

    carrier.frequency.setValueAtTime(150, t0);
    formantOne.frequency.setValueAtTime(760, t0);
    formantTwo.frequency.setValueAtTime(1550, t0);
    for (let t = 0.02; t < length - 0.1; t += 0.02) {
      const x = t / length;
      // Pitch rises then falls, with a few percent of jitter: the wood sticks and slips.
      const base = 150 + 110 * Math.sin(Math.PI * Math.min(1, x * 1.15));
      carrier.frequency.linearRampToValueAtTime(base * jitter(v.rng, 0.05), t0 + t);
      formantOne.frequency.linearRampToValueAtTime(760 + 240 * x, t0 + t);
      formantTwo.frequency.linearRampToValueAtTime(1550 + 400 * x, t0 + t);
    }
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(0.9, t0 + 0.14);
    env.gain.linearRampToValueAtTime(0.7, t0 + length * 0.6);
    env.gain.exponentialRampToValueAtTime(FLOOR, t0 + length - 0.02);
    chain(env, out);

    // A little air through the fibres.
    const hiss = rig.noiseSrc(0.6);
    const hissFilter = rig.filter("bandpass", 2300, 2);
    const hissGain = rig.gain(0.06);
    chain(hiss, hissFilter, hissGain, env);
  },
};

// --- the jumpscare --------------------------------------------------------------------------------------------------------

const SCREAM_VOICES = [
  { type: "sawtooth", ratio: 1, detune: -18 },
  { type: "sawtooth", ratio: 1, detune: 14 },
  { type: "square", ratio: 0.5, detune: -7 },
  { type: "sawtooth", ratio: 1.498, detune: 22 },
] as const;

const scream: CueDef = {
  duration: 1.6,
  level: 0.75,
  build(rig, out, v) {
    const t0 = rig.t0;
    const mix = rig.gain(0.22);
    const vibrato = rig.osc("sine", 6.5 + v.rng() * 1.5);
    const vibratoDepth = rig.gain(45);
    chain(vibrato, vibratoDepth);
    for (const voice of SCREAM_VOICES) {
      const osc = rig.osc(voice.type, 340 * voice.ratio);
      osc.detune.value = voice.detune;
      // A fast upward sweep in the first 60 ms, then a slow fall: the cry opens wide and breaks down.
      osc.frequency.setValueAtTime(340 * voice.ratio, t0);
      osc.frequency.exponentialRampToValueAtTime(980 * voice.ratio, t0 + 0.06);
      osc.frequency.exponentialRampToValueAtTime(820 * voice.ratio, t0 + 0.35);
      osc.frequency.exponentialRampToValueAtTime(640 * voice.ratio, t0 + 1.0);
      osc.frequency.exponentialRampToValueAtTime(420 * voice.ratio, t0 + 1.55);
      modulate(vibratoDepth, osc.detune);
      chain(osc, mix);
    }
    // Waveshaper distortion when the context offers one. Its output never exceeds the input range.
    const shaper = rig.shaper();
    const voiced = rig.gain(1);
    if (shaper) chain(mix, shaper, voiced);
    else chain(mix, voiced);

    const formantOne = rig.filter("bandpass", 600, 5);
    const formantTwo = rig.filter("bandpass", 1700, 6);
    const formantOneGain = rig.gain(1.1);
    const formantTwoGain = rig.gain(0.9);
    formantOne.frequency.setValueAtTime(600, t0);
    formantOne.frequency.linearRampToValueAtTime(1250, t0 + 0.12);
    formantOne.frequency.linearRampToValueAtTime(800, t0 + 1.4);
    formantTwo.frequency.setValueAtTime(1700, t0);
    formantTwo.frequency.linearRampToValueAtTime(2800, t0 + 0.12);
    formantTwo.frequency.linearRampToValueAtTime(2100, t0 + 1.4);
    const env = rig.gain(FLOOR);
    // Attack in 4 ms, then a controlled decay to silence at about 1.5 s.
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.004);
    env.gain.exponentialRampToValueAtTime(0.6, t0 + 0.3);
    env.gain.exponentialRampToValueAtTime(0.3, t0 + 0.9);
    env.gain.exponentialRampToValueAtTime(0.1, t0 + 1.35);
    env.gain.exponentialRampToValueAtTime(FLOOR, t0 + 1.56);
    chain(voiced, formantOne, formantOneGain, env);
    chain(voiced, formantTwo, formantTwoGain, env);
    chain(env, out);

    const noise = rig.noiseSrc(0.1);
    const noiseFilter = rig.filter("bandpass", 2600, 0.6);
    const noiseGain = rig.gain(FLOOR);
    strike(noiseGain.gain, t0, 0.5, 0.35, 0.003);
    chain(noise, noiseFilter, noiseGain, out);

    const sub = rig.osc("sine", 95);
    sub.frequency.setValueAtTime(95, t0);
    sub.frequency.exponentialRampToValueAtTime(38, t0 + 0.3);
    const subGain = rig.gain(FLOOR);
    strike(subGain.gain, t0, 0.6, 0.5, 0.004);
    chain(sub, subGain, out);
  },
};

/** The heavy impact that goes with being caught. The softened variant keeps the weight but drops the crack and the bite. */
const caught: CueDef = {
  duration: 0.9,
  level: 0.5,
  build(rig, out, v) {
    const t = rig.t0;
    const rise = v.soft ? 0.03 : 0.004;
    const sub = rig.osc("sine", 80);
    sub.frequency.setValueAtTime(84, t);
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    const subGain = rig.gain(FLOOR);
    strike(subGain.gain, t, 0.9, 0.8, rise);
    chain(sub, subGain, out);
    modal(rig, out, 150, [
      { ratio: 1, amp: 0.9, decay: 0.7 },
      { ratio: 2.2, amp: 0.4, decay: 0.45 },
      { ratio: 3.6, amp: 0.2, decay: 0.28 },
    ], [{ t, amp: v.soft ? 0.6 : 1 }]);
    if (!v.soft) clickNoise(rig, out, t, "lowpass", 900, 0.7, 0.55, 0.05, 2.1);
  },
};

// --- the creature ---------------------------------------------------------------------------------------------------------

const breath: CueDef = {
  duration: 1.4,
  level: 0.8,
  build(rig, out, v) {
    const t0 = rig.t0;
    const rasp = rig.gain(0.65);
    const noise = rig.noiseSrc(1.7);
    const band = rig.filter("bandpass", 800, 0.9);
    const raspLfo = rig.osc("sawtooth", 58 + v.rng() * 12);
    const raspDepth = rig.gain(0.35);
    chain(raspLfo, raspDepth);
    modulate(raspDepth, rasp.gain);
    const env = rig.gain(FLOOR);
    chain(noise, band, rasp, env, out);
    // In, then out. The inhale is thinner and higher, the exhale lower and longer.
    band.frequency.setValueAtTime(800, t0);
    band.frequency.linearRampToValueAtTime(1500, t0 + 0.5);
    band.frequency.linearRampToValueAtTime(1100, t0 + 0.6);
    band.frequency.linearRampToValueAtTime(600, t0 + 1.3);
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.linearRampToValueAtTime(0.5, t0 + 0.45);
    env.gain.linearRampToValueAtTime(0.06, t0 + 0.6);
    env.gain.linearRampToValueAtTime(1, t0 + 0.78);
    env.gain.exponentialRampToValueAtTime(FLOOR, t0 + 1.36);
    // A faint vocal resonance under the exhale.
    const voice = rig.osc("sawtooth", 92);
    voice.frequency.setValueAtTime(96, t0 + 0.6);
    voice.frequency.linearRampToValueAtTime(78, t0 + 1.3);
    const voiceFilter = rig.filter("bandpass", 520, 4);
    const voiceGain = rig.gain(FLOOR);
    voiceGain.gain.setValueAtTime(FLOOR, t0 + 0.55);
    voiceGain.gain.linearRampToValueAtTime(0.12, t0 + 0.8);
    voiceGain.gain.exponentialRampToValueAtTime(FLOOR, t0 + 1.35);
    chain(voice, voiceFilter, voiceGain, out);
  },
};

const heartbeat: CueDef = {
  duration: 0.42,
  level: 0.6,
  build(rig, out) {
    const t0 = rig.t0;
    // Lub, then a softer dub about 0.2 s later.
    for (const beat of [{ at: 0, amp: 1, from: 84, to: 52 }, { at: 0.2, amp: 0.7, from: 96, to: 58 }]) {
      const osc = rig.osc("sine", beat.from);
      osc.frequency.setValueAtTime(beat.from, t0 + beat.at);
      osc.frequency.exponentialRampToValueAtTime(beat.to, t0 + beat.at + 0.1);
      const gain = rig.gain(FLOOR);
      strike(gain.gain, t0 + beat.at, beat.amp, 0.16, 0.006);
      chain(osc, gain, out);
    }
    clickNoise(rig, out, t0, "lowpass", 700, 0.7, 0.35, 0.05, 0.5);
    clickNoise(rig, out, t0 + 0.2, "lowpass", 700, 0.7, 0.22, 0.05, 0.9);
  },
};

const monsterStep: CueDef = {
  duration: 0.4,
  level: 0.4,
  build(rig, out, v) {
    const t = rig.t0;
    const f0 = 88 * jitter(v.rng, 0.12);
    // A heavy heel strike, then the sole slaps down a moment later. The gap varies, so the gait is a little uneven.
    const slap = 0.07 + v.rng() * 0.04;
    modal(rig, out, f0, [
      { ratio: 1, amp: 1, decay: 0.2 },
      { ratio: 1.9, amp: 0.6, decay: 0.14 },
      { ratio: 3.2, amp: 0.34, decay: 0.1 },
    ], [{ t, amp: 1 }, { t: t + slap, amp: 0.45 }]);
    clickNoise(rig, out, t, "bandpass", 1100, 1, 0.45, 0.012, 0.3);
    clickNoise(rig, out, t + slap, "lowpass", 420, 0.7, 0.4, 0.07, 1.2);
  },
};

// --- distant presence -----------------------------------------------------------------------------------------------------

const drip: CueDef = {
  duration: 0.5,
  level: 0.3,
  build(rig, out) {
    const t0 = rig.t0;
    const osc = rig.osc("sine", 1300);
    const gain = rig.gain(FLOOR);
    const soften = rig.filter("lowpass", 3200, 0.7);
    // A drop and its fainter echo: the pitch rises quickly as the bubble closes.
    for (const drop of [{ at: 0, amp: 0.8, low: 1300, high: 2300 }, { at: 0.17, amp: 0.2, low: 1150, high: 2000 }]) {
      osc.frequency.setValueAtTime(drop.low, t0 + drop.at);
      osc.frequency.exponentialRampToValueAtTime(drop.high, t0 + drop.at + 0.03);
      strike(gain.gain, t0 + drop.at, drop.amp, 0.1, 0.002);
    }
    chain(osc, gain, soften, out);
  },
};

const pipeTick: CueDef = {
  duration: 0.5,
  level: 0.3,
  build(rig, out) {
    const t0 = rig.t0;
    modal(rig, out, 900, [
      { ratio: 1, amp: 1, decay: 0.2 },
      { ratio: 2.58, amp: 0.6, decay: 0.14 },
      { ratio: 4.17, amp: 0.35, decay: 0.09 },
    ], [{ t: t0, amp: 1 }, { t: t0 + 0.14, amp: 0.45 }]);
    clickNoise(rig, out, t0, "bandpass", 3200, 1.5, 0.3, 0.006, 0.8);
  },
};

const rumble: CueDef = {
  duration: 2.4,
  level: 0.5,
  build(rig, out, v) {
    const t0 = rig.t0;
    const length = rig.end - rig.t0;
    const noise = rig.noiseSrc(0.9);
    const low = rig.filter("lowpass", 170, 0.7);
    const gain = rig.gain(FLOOR);
    chain(noise, low, gain, out);
    const slow = wobble(v.rng, 0.4);
    gain.gain.setValueAtTime(FLOOR, t0);
    for (let t = 0.1; t < length - 0.3; t += 0.1) {
      const swell = Math.sin((Math.PI * t) / length);
      gain.gain.linearRampToValueAtTime(Math.max(FLOOR, swell * (0.8 + 0.2 * slow(t))), t0 + t);
    }
    gain.gain.linearRampToValueAtTime(FLOOR, t0 + length - 0.02);
    for (const [frequency, amp] of [[48, 0.5], [64, 0.3]] as const) {
      const osc = rig.osc("sine", frequency);
      const oscGain = rig.gain(FLOOR);
      oscGain.gain.setValueAtTime(FLOOR, t0);
      oscGain.gain.linearRampToValueAtTime(amp, t0 + length * 0.45);
      oscGain.gain.linearRampToValueAtTime(FLOOR, t0 + length - 0.02);
      chain(osc, oscGain, out);
    }
  },
};

const proximity: CueDef = {
  duration: 2.6,
  level: 0.5,
  build(rig, out) {
    const t0 = rig.t0;
    const length = rig.end - rig.t0;
    const saw = rig.osc("sawtooth", 52);
    saw.frequency.setValueAtTime(70, t0);
    saw.frequency.exponentialRampToValueAtTime(130, t0 + length - 0.5);
    const low = rig.filter("lowpass", 180, 1.2);
    low.frequency.setValueAtTime(180, t0);
    low.frequency.exponentialRampToValueAtTime(460, t0 + length - 0.5);
    const sub = rig.osc("sine", 44);
    sub.frequency.setValueAtTime(44, t0);
    sub.frequency.exponentialRampToValueAtTime(72, t0 + length - 0.5);
    const env = rig.gain(FLOOR);
    env.gain.setValueAtTime(FLOOR, t0);
    env.gain.exponentialRampToValueAtTime(0.9, t0 + length - 0.7);
    env.gain.exponentialRampToValueAtTime(FLOOR, t0 + length - 0.03);
    const sawGain = rig.gain(0.9);
    chain(saw, low, sawGain, env);
    chain(sub, env);
    chain(env, out);
  },
};

export const PROCEDURAL_CUES = {
  woodKnock,
  woodThud,
  planchetteTick,
  planchetteSlide,
  woodCreak,
  scream,
  caught,
  breath,
  heartbeat,
  monsterStep,
  drip,
  pipeTick,
  rumble,
  proximity,
} as const satisfies Record<string, CueDef>;

export type ProceduralCue = keyof typeof PROCEDURAL_CUES;
