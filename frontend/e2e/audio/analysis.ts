/**
 * Signal analysis for the audio measurements. Pure Node code, no browser: it takes rendered samples and reports numbers.
 * Also writes PCM16 WAV files so the owner can listen to every cue.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface Rendered {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
}

export interface BandEnergy {
  label: string;
  low: number;
  high: number;
  /** Share of the active signal's power in this band, 0 to 1. */
  fraction: number;
}

export interface Metrics {
  /** Seconds from the first audible sample to the last audible sample (above -60 dBFS in 10 ms windows). */
  durationSeconds: number;
  onsetSeconds: number;
  endSeconds: number;
  peakDb: number;
  rmsDb: number;
  crestDb: number;
  clipped: boolean;
  centroidHz: number;
  /** Time from the onset (1% of peak) to the first sample at 90% of peak. */
  attackMs: number;
  bands: BandEnergy[];
  dominantBand: string;
  /** Geometric over arithmetic mean of the power spectrum between 100 Hz and 6 kHz, over the first 120 ms. 1 is noise, near 0 is a pure tone. */
  flatness: number;
  /** Local maxima in the first 120 ms spectrum that are within 35 dB of the strongest. */
  peakCount: number;
  /** Standard deviation over mean of the 10 ms RMS envelope, trimmed at both ends. Zero is steady, high is strongly modulated. */
  modulation: number;
}

export const BAND_EDGES = [0, 80, 150, 300, 600, 1200, 2400, 4800, 9600, Infinity] as const;

const toDb = (linear: number): number => (linear > 1e-9 ? 20 * Math.log10(linear) : -180);

export function mixToMono(left: Float32Array, right: Float32Array): Float32Array {
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i += 1) mono[i] = (left[i]! + right[i]!) / 2;
  return mono;
}

/** In-place iterative radix-2 FFT. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k += 1) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

/** Average power spectrum (Hann window, 50% overlap) of a segment. Returns bin power and the bin width in Hz. */
export function powerSpectrum(samples: Float32Array, sampleRate: number, maxSize = 4096): { power: Float64Array; binHz: number } {
  // A short segment gets a short frame, so the window covers the segment instead of mostly zeros.
  let size = 256;
  while (size < samples.length && size < maxSize) size *= 2;
  const power = new Float64Array(size / 2);
  const window = new Float64Array(size);
  for (let i = 0; i < size; i += 1) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  const hop = size / 2;
  let frames = 0;
  const frameCount = Math.max(1, Math.ceil((samples.length - size) / hop) + 1);
  for (let f = 0; f < frameCount; f += 1) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i += 1) re[i] = (samples[f * hop + i] ?? 0) * window[i]!;
    fft(re, im);
    for (let k = 0; k < size / 2; k += 1) power[k] = power[k]! + re[k]! * re[k]! + im[k]! * im[k]!;
    frames += 1;
  }
  for (let k = 0; k < power.length; k += 1) power[k] = power[k]! / frames;
  return { power, binHz: sampleRate / size };
}

function windowRms(samples: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  for (let i = start; i < end; i += 1) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** RMS in consecutive windows of `seconds`. */
export function envelope(samples: Float32Array, sampleRate: number, seconds = 0.01): Float64Array {
  const win = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float64Array(Math.floor(samples.length / win));
  for (let i = 0; i < out.length; i += 1) out[i] = windowRms(samples, i * win, win);
  return out;
}

export function analyse(rendered: Rendered): Metrics {
  const { sampleRate, left, right } = rendered;
  const mono = mixToMono(left, right);
  let peak = 0;
  let clipped = false;
  for (let i = 0; i < left.length; i += 1) {
    const a = Math.max(Math.abs(left[i]!), Math.abs(right[i]!));
    if (a > peak) peak = a;
    if (a >= 0.9999) clipped = true;
  }
  const env = envelope(mono, sampleRate, 0.01);
  const floor = 10 ** (-60 / 20);
  let first = env.findIndex((v) => v > floor);
  let last = -1;
  for (let i = env.length - 1; i >= 0; i -= 1) if (env[i]! > floor) { last = i; break; }
  if (first < 0) first = 0;
  if (last < first) last = first;
  const onsetSeconds = first * 0.01;
  const endSeconds = (last + 1) * 0.01;
  const startIdx = Math.floor(onsetSeconds * sampleRate);
  const endIdx = Math.min(mono.length, Math.floor(endSeconds * sampleRate));
  const active = mono.subarray(startIdx, endIdx);

  // RMS over the audible span, of the louder channel.
  const rmsOf = (c: Float32Array): number => windowRms(c.subarray(startIdx, endIdx), 0, endIdx - startIdx);
  const rms = Math.max(rmsOf(left), rmsOf(right));

  // Attack: from 1% of peak to 90% of peak.
  let onsetSample = 0;
  let t90 = 0;
  for (let i = 0; i < left.length; i += 1) {
    const a = Math.max(Math.abs(left[i]!), Math.abs(right[i]!));
    if (!onsetSample && a >= peak * 0.01) onsetSample = i;
    if (a >= peak * 0.9) { t90 = i; break; }
  }

  const { power, binHz } = powerSpectrum(active, sampleRate);
  let total = 0;
  let weighted = 0;
  const bandSums = new Array<number>(BAND_EDGES.length - 1).fill(0);
  for (let k = 1; k < power.length; k += 1) {
    const f = k * binHz;
    total += power[k]!;
    weighted += power[k]! * f;
    for (let b = 0; b < bandSums.length; b += 1) {
      if (f >= BAND_EDGES[b]! && f < BAND_EDGES[b + 1]!) {
        bandSums[b] = bandSums[b]! + power[k]!;
        break;
      }
    }
  }
  const bands: BandEnergy[] = bandSums.map((sum, b) => ({
    label: `${BAND_EDGES[b]}-${BAND_EDGES[b + 1] === Infinity ? "max" : BAND_EDGES[b + 1]}`,
    low: BAND_EDGES[b]!,
    high: BAND_EDGES[b + 1]!,
    fraction: total > 0 ? sum / total : 0,
  }));
  const dominant = bands.reduce((best, band) => (band.fraction > best.fraction ? band : best), bands[0]!);

  // Tonal structure of the strike: the first 120 ms after the onset.
  const head = mono.subarray(startIdx, Math.min(mono.length, startIdx + Math.round(0.12 * sampleRate)));
  const headSpectrum = powerSpectrum(head, sampleRate, 4096);
  const kLow = Math.ceil(100 / headSpectrum.binHz);
  const kHigh = Math.floor(6000 / headSpectrum.binHz);
  let logSum = 0;
  let linSum = 0;
  let maxPower = 0;
  for (let k = kLow; k <= kHigh; k += 1) {
    const p = headSpectrum.power[k]! + 1e-30;
    logSum += Math.log(p);
    linSum += p;
    if (p > maxPower) maxPower = p;
  }
  const count = kHigh - kLow + 1;
  const flatness = Math.exp(logSum / count) / (linSum / count);
  let peakCount = 0;
  const minPeak = maxPower * 10 ** (-35 / 10);
  for (let k = kLow + 1; k < kHigh; k += 1) {
    const p = headSpectrum.power[k]!;
    if (p >= minPeak && p > headSpectrum.power[k - 1]! && p >= headSpectrum.power[k + 1]! && p > headSpectrum.power[k - 3]! && p >= headSpectrum.power[k + 3]!) peakCount += 1;
  }

  const trim = Math.floor((last - first) * 0.15);
  const body = env.subarray(first + trim, Math.max(first + trim + 1, last - trim));
  const mean = body.reduce((a, b) => a + b, 0) / Math.max(1, body.length);
  const variance = body.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, body.length);

  return {
    durationSeconds: endSeconds - onsetSeconds,
    onsetSeconds,
    endSeconds,
    peakDb: toDb(peak),
    rmsDb: toDb(rms),
    crestDb: toDb(peak) - toDb(rms),
    clipped,
    centroidHz: total > 0 ? weighted / total : 0,
    attackMs: ((t90 - onsetSample) / sampleRate) * 1000,
    bands,
    dominantBand: dominant.label,
    flatness,
    peakCount,
    modulation: mean > 0 ? Math.sqrt(variance) / mean : 0,
  };
}

/** Share of the active power between two frequencies. */
export function fractionBetween(metrics: Metrics, low: number, high: number): number {
  return metrics.bands.filter((b) => b.low >= low && b.high <= high).reduce((sum, b) => sum + b.fraction, 0);
}

/** Power in a frequency range for the segment between two times, as a share of that segment's total power. */
export function segmentFraction(rendered: Rendered, fromSeconds: number, toSeconds: number, lowHz: number, highHz: number): number {
  const mono = mixToMono(rendered.left, rendered.right);
  const segment = mono.subarray(Math.floor(fromSeconds * rendered.sampleRate), Math.floor(toSeconds * rendered.sampleRate));
  const { power, binHz } = powerSpectrum(segment, rendered.sampleRate);
  let total = 0;
  let inside = 0;
  for (let k = 1; k < power.length; k += 1) {
    total += power[k]!;
    const f = k * binHz;
    if (f >= lowHz && f < highHz) inside += power[k]!;
  }
  return total > 0 ? inside / total : 0;
}

/** RMS of a time segment. */
export function segmentRms(rendered: Rendered, fromSeconds: number, toSeconds: number): number {
  const mono = mixToMono(rendered.left, rendered.right);
  const from = Math.floor(fromSeconds * rendered.sampleRate);
  return windowRms(mono, from, Math.floor(toSeconds * rendered.sampleRate) - from);
}

/** One-pole high-pass, for looking at clicks in a bed without its low tones. */
export function highPass(samples: Float32Array, sampleRate: number, cutoff: number): Float32Array {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  const out = new Float32Array(samples.length);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < samples.length; i += 1) {
    prevOut = alpha * (prevOut + samples[i]! - prevIn);
    prevIn = samples[i]!;
    out[i] = prevOut;
  }
  return out;
}

/** One-pole low-pass. */
export function lowPass(samples: Float32Array, sampleRate: number, cutoff: number): Float32Array {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  const out = new Float32Array(samples.length);
  let state = 0;
  for (let i = 0; i < samples.length; i += 1) {
    state += alpha * (samples[i]! - state);
    out[i] = state;
  }
  return out;
}

/**
 * Times (seconds) where the smoothed envelope rises through `fraction` of its maximum, with a refractory period.
 * Used to find heartbeats.
 */
export function onsets(samples: Float32Array, sampleRate: number, fraction: number, refractorySeconds: number): number[] {
  const rectified = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) rectified[i] = Math.abs(samples[i]!);
  const smooth = lowPass(rectified, sampleRate, 25);
  let max = 0;
  for (const v of smooth) if (v > max) max = v;
  const threshold = max * fraction;
  const times: number[] = [];
  let armedAt = -Infinity;
  for (let i = 1; i < smooth.length; i += 1) {
    const t = i / sampleRate;
    if (smooth[i - 1]! < threshold && smooth[i]! >= threshold && t - armedAt >= refractorySeconds) {
      times.push(t);
      armedAt = t;
    }
  }
  return times;
}

/** Write 16-bit PCM stereo. Samples are clamped, never wrapped. */
export function writeWav(path: string, rendered: Rendered): void {
  const { sampleRate, left, right } = rendered;
  const frames = left.length;
  const data = Buffer.alloc(44 + frames * 4);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + frames * 4, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(2, 22);
  data.writeUInt32LE(sampleRate, 24);
  data.writeUInt32LE(sampleRate * 4, 28);
  data.writeUInt16LE(4, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(frames * 4, 40);
  const clamp = (v: number): number => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < frames; i += 1) {
    data.writeInt16LE(clamp(left[i]!), 44 + i * 4);
    data.writeInt16LE(clamp(right[i]!), 46 + i * 4);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}
