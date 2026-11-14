/**
 * Measured audio quality. Every cue is rendered by the real AudioController through an OfflineAudioContext in Edge, at the
 * worst-case levels (master volume, ambient and effects all at 1), then analysed here in Node. Each rendered cue is saved
 * as a WAV file in %TEMP%\sean-audio, together with report.json and report.md.
 *
 * These tests measure; they cannot say whether a sound is pleasant. Listen to the WAV files for that.
 */

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Cue } from "../../src/features/audio/AudioController";
import {
  analyse, envelope, fractionBetween, highPass, mixToMono, onsets, segmentFraction, segmentRms, writeWav,
  type Metrics, type Rendered,
} from "./analysis";
import { OUTPUT_DIR, SAMPLE_RATE, render, singleCue, type RenderResult, type Scenario } from "./harness";

const ALL_CUES: Cue[] = [
  "settle", "glitch", "whisper", "clue", "caught", "door", "escape", "planchette", "footstep", "footstepRun", "flashlight", "growl",
  "monsterStep", "woodKnock", "woodThud", "planchetteTick", "planchetteSlide", "woodCreak", "scream", "breath", "heartbeat", "drip",
  "pipeTick", "rumble", "proximity",
];

const AT = 0.25;
const SAFE_PEAK_DB = -3;

interface Entry {
  name: string;
  metrics: Metrics;
  result: RenderResult;
  note?: string;
}

const entries = new Map<string, Entry>();
let page: Page;

async function measure(name: string, scenario: Scenario, note?: string): Promise<Entry> {
  const cached = entries.get(name);
  if (cached) return cached;
  const result = await render(page, scenario);
  writeWav(join(OUTPUT_DIR, `${name}.wav`), result);
  const entry = { name, metrics: analyse(result), result, note };
  entries.set(name, entry);
  return entry;
}

async function cueEntry(cue: Cue, options?: { pan?: number; gain?: number; priority?: boolean }): Promise<Entry> {
  const duration = (await durationOf(cue)) + AT + 0.4;
  return measure(options ? `${cue}-${JSON.stringify(options).replace(/[^a-z0-9.]+/gi, "_")}` : cue, singleCue(cue, duration, options));
}

const durations = new Map<string, number>();
async function durationOf(cue: Cue): Promise<number> {
  if (!durations.has(cue)) {
    const probe = await render(page, { seconds: 0.5, events: [{ at: 0.1, cue }] });
    durations.set(cue, probe.cuesDurationSeconds[cue]!);
  }
  return durations.get(cue)!;
}

const fmt = (value: number, digits = 1): string => (Number.isFinite(value) ? value.toFixed(digits) : "n/a");

function writeReport(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows = [...entries.values()].map((e) => ({
    name: e.name,
    durationSeconds: e.metrics.durationSeconds,
    attackMs: e.metrics.attackMs,
    peakDb: e.metrics.peakDb,
    rmsDb: e.metrics.rmsDb,
    crestDb: e.metrics.crestDb,
    centroidHz: e.metrics.centroidHz,
    dominantBand: e.metrics.dominantBand,
    clipped: e.metrics.clipped,
    flatness: e.metrics.flatness,
    peakCount: e.metrics.peakCount,
    modulation: e.metrics.modulation,
    nodesCreated: e.result.nodesCreated,
    note: e.note ?? "",
  }));
  writeFileSync(join(OUTPUT_DIR, "report.json"), JSON.stringify({ sampleRate: SAMPLE_RATE, levels: "master volume, ambient and effects at 1.0", rows }, null, 2));
  const lines = [
    "# Sean audio measurements",
    "",
    `Rendered through OfflineAudioContext in Edge at ${SAMPLE_RATE} Hz, master volume, ambient and effects at 1.0 (the worst case).`,
    "These are measurements, not listening results.",
    "",
    "| Cue | Duration s | Attack ms | Peak dBFS | RMS dBFS | Crest dB | Centroid Hz | Dominant band Hz | Clipped | Nodes |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.name} | ${fmt(r.durationSeconds, 2)} | ${fmt(r.attackMs)} | ${fmt(r.peakDb)} | ${fmt(r.rmsDb)} | ${fmt(r.crestDb)} | ${fmt(r.centroidHz, 0)} | ${r.dominantBand} | ${r.clipped ? "YES" : "no"} | ${r.nodesCreated} |`),
    "",
  ];
  writeFileSync(join(OUTPUT_DIR, "report.md"), lines.join("\n"));
}

test.skip(process.env.SEAN_AUDIO_SUITE !== "1", "Run with playwright.audio.config.ts");

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // The browser asks the bare module page for a favicon, which the dev server does not have. That is not the audio code.
    if (message.type() === "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(message.text());
  });
  // Any document on the dev server's origin will do. The raw module avoids loading the whole application.
  await page.goto("http://127.0.0.1:5373/src/features/audio/synth.ts");
  (page as unknown as { audioErrors: string[] }).audioErrors = errors;
});

test.afterAll(async () => {
  writeReport();
  await page?.close();
});

test("no page errors occurred while rendering", async () => {
  await cueEntry("woodKnock");
  expect((page as unknown as { audioErrors: string[] }).audioErrors).toEqual([]);
});

// --- every cue --------------------------------------------------------------------------------------------------------------

test.describe("every cue", () => {
  for (const cue of ALL_CUES) {
    test(`${cue}: safe peak, no clipping, within its duration, nothing left running`, async () => {
      const entry = await cueEntry(cue);
      const { metrics, result } = entry;
      const spec = result.cuesDurationSeconds[cue]!;
      expect(result.failed).toBe(false);
      expect(metrics.peakDb, "audible").toBeGreaterThan(-60);
      expect(metrics.peakDb, "peak").toBeLessThanOrEqual(SAFE_PEAK_DB);
      expect(metrics.clipped).toBe(false);
      // The audible part (above -60 dBFS) ends no later than the cue's own duration, within one 10 ms window.
      expect(metrics.endSeconds - AT).toBeLessThanOrEqual(spec + 0.03);
      expect(result.activeCuesAfter).toBe(0);
      expect(result.activeCuesDisposed).toBe(0);
    });
  }
});

// --- wood --------------------------------------------------------------------------------------------------------------------

function pureSine(): Rendered {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * 1));
  for (let i = Math.round(AT * SAMPLE_RATE); i < samples.length; i += 1) {
    const t = i / SAMPLE_RATE - AT;
    samples[i] = 0.3 * Math.sin(2 * Math.PI * 250 * t) * Math.exp(-t * 10);
  }
  return { sampleRate: SAMPLE_RATE, left: samples, right: samples };
}

for (const cue of ["woodKnock", "woodThud"] as const) {
  test(`${cue} is a ringing piece of wood: decaying, 150-1500 Hz, a noise click, and not a pure sine`, async () => {
    const { metrics, result } = await cueEntry(cue);
    const on = metrics.onsetSeconds;
    const early = segmentRms(result, on, on + 0.06);
    const middle = segmentRms(result, on + 0.06, on + 0.18);
    const late = segmentRms(result, on + 0.18, on + 0.4);
    expect(early).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(late);
    expect(early / late).toBeGreaterThan(4);
    // Energy sits in the body of the wood.
    const body = segmentFraction(result, on, on + 0.5, cue === "woodKnock" ? 150 : 60, 1500);
    expect(body).toBeGreaterThan(0.7);
    // A short noise click at the start has far more high-frequency content than the ring after it.
    const clickHigh = segmentFraction(result, on, on + 0.012, 2000, 12000);
    const ringHigh = segmentFraction(result, on + 0.1, on + 0.3, 2000, 12000);
    expect(clickHigh).toBeGreaterThan(cue === "woodKnock" ? 0.1 : 0.01);
    expect(clickHigh).toBeGreaterThan(ringHigh * 3);
    // Not a pure sine: several spectral peaks and a flatter spectrum than a decaying sine measured the same way.
    const sine = analyse(pureSine());
    expect(metrics.peakCount).toBeGreaterThanOrEqual(3);
    expect(metrics.flatness).toBeGreaterThan(sine.flatness * 5);
    expect(metrics.attackMs).toBeLessThan(15);
  });
}

test("repeated knocks differ a little, and the same knock sequence is identical on every run", async () => {
  const two: Scenario = { seconds: 1.6, events: [{ at: 0.2, cue: "woodKnock" }, { at: 0.9, cue: "woodKnock" }] };
  const a = await render(page, two);
  const b = await render(page, two);
  let worst = 0;
  for (let i = 0; i < 60000; i += 1) worst = Math.max(worst, Math.abs(a.left[i]! - b.left[i]!));
  expect(worst, "largest sample difference between two identical renders").toBeLessThan(1e-6);
  const first = a.left.subarray(Math.round(0.2 * SAMPLE_RATE), Math.round(0.5 * SAMPLE_RATE));
  const second = a.left.subarray(Math.round(0.9 * SAMPLE_RATE), Math.round(1.2 * SAMPLE_RATE));
  let difference = 0;
  for (let i = 0; i < first.length; i += 1) difference += Math.abs(first[i]! - second[i]!);
  expect(difference).toBeGreaterThan(0.5);
});

test("planchette contact is a soft tick plus a short thump", async () => {
  const { metrics, result } = await cueEntry("planchetteTick");
  const on = metrics.onsetSeconds;
  expect(metrics.durationSeconds).toBeLessThan(0.2);
  expect(segmentFraction(result, on, on + 0.01, 1500, 6000)).toBeGreaterThan(0.3);
  expect(segmentFraction(result, on + 0.02, on + 0.12, 60, 500)).toBeGreaterThan(0.6);
});

test("sliding friction is broadband noise between 600 and 4000 Hz with an irregular amplitude", async () => {
  const { metrics, result } = await cueEntry("planchetteSlide");
  const on = metrics.onsetSeconds;
  expect(segmentFraction(result, on + 0.1, on + 0.8, 600, 4000)).toBeGreaterThan(0.6);
  // Broadband, not tonal: a flat-ish spectrum, far from a pure tone's.
  expect(metrics.flatness).toBeGreaterThan(0.02);
  expect(metrics.flatness).toBeGreaterThan(analyse(pureSine()).flatness * 1000);
  expect(metrics.modulation).toBeGreaterThan(0.2);
  // The 10 ms envelope keeps changing: many direction changes, not a smooth ramp.
  const env = envelope(mixToMono(result.left, result.right), SAMPLE_RATE, 0.01);
  let turns = 0;
  for (let i = Math.floor(on * 100) + 12; i < Math.floor(metrics.endSeconds * 100) - 12; i += 1) {
    if ((env[i]! - env[i - 1]!) * (env[i + 1]! - env[i]!) < 0) turns += 1;
  }
  expect(turns).toBeGreaterThan(8);
});

test("the creak is a rough, resonant, sliding tone", async () => {
  const { metrics, result } = await cueEntry("woodCreak");
  const on = metrics.onsetSeconds;
  expect(metrics.centroidHz).toBeGreaterThan(500);
  expect(metrics.centroidHz).toBeLessThan(3000);
  expect(segmentFraction(result, on + 0.1, on + 0.7, 400, 3000)).toBeGreaterThan(0.7);
  expect(metrics.modulation).toBeGreaterThan(0.1);
  // It is tonal enough to have a pitch, unlike plain noise.
  expect(metrics.flatness).toBeLessThan(0.2);
});

// --- the jumpscare ----------------------------------------------------------------------------------------------------------

test("the scream is strong at the onset, bounded, audible and bright", async () => {
  const { metrics } = await cueEntry("scream");
  expect(metrics.peakDb).toBeLessThanOrEqual(SAFE_PEAK_DB);
  expect(metrics.peakDb).toBeGreaterThan(-12);
  expect(metrics.clipped).toBe(false);
  expect(metrics.rmsDb).toBeGreaterThan(-30);
  expect(metrics.rmsDb).toBeLessThan(-12);
  expect(metrics.centroidHz).toBeGreaterThan(800);
  expect(metrics.centroidHz).toBeLessThan(3500);
  expect(metrics.attackMs).toBeLessThanOrEqual(30);
  expect(metrics.durationSeconds).toBeGreaterThan(1.0);
  expect(metrics.durationSeconds).toBeLessThan(1.8);
});

test("the scream stays within -3 dBFS without a waveshaper too", async () => {
  const entry = await measure("scream-no-waveshaper", { ...singleCue("scream", 2.3), waveShaper: false });
  expect(entry.metrics.peakDb).toBeLessThanOrEqual(SAFE_PEAK_DB);
  expect(entry.metrics.clipped).toBe(false);
  expect(entry.metrics.attackMs).toBeLessThanOrEqual(30);
  expect(entry.metrics.centroidHz).toBeGreaterThan(800);
  expect(entry.metrics.centroidHz).toBeLessThan(3500);
});

test("the scream is refused when intense sound is not allowed, and the caught impact is softened", async () => {
  const refused = await measure("scream-refused", { ...singleCue("scream", 2.3), intenseAllowed: false });
  expect(refused.result.intenseAllowed).toBe(false);
  expect(refused.metrics.peakDb).toBeLessThan(-90);
  const normal = await cueEntry("caught");
  const soft = await measure("caught-soft", { ...singleCue("caught", 1.5), intenseAllowed: false });
  expect(soft.metrics.peakDb).toBeLessThan(normal.metrics.peakDb - 6);
  expect(soft.metrics.peakDb).toBeGreaterThan(-60);
});

test("the worst jumpscare mix stays under -3 dBFS and does not clip", async () => {
  const mix: Scenario = {
    seconds: 2.4,
    mood: "tension",
    tension: [{ at: 0.05, level: 1 }],
    events: [
      { at: 0.4, cue: "heartbeat", options: { priority: true } },
      { at: 0.45, cue: "breath" },
      { at: 0.5, cue: "monsterStep" },
      { at: 0.55, cue: "growl" },
      { at: 0.6, cue: "scream", options: { priority: true } },
      { at: 0.6, cue: "caught", options: { priority: true } },
      { at: 0.6, cue: "woodThud" },
    ],
  };
  const entry = await measure("jumpscare-worst-mix", mix, "scream + caught + thud + growl + step + breath + heartbeat + tension bed");
  expect(entry.metrics.peakDb).toBeLessThanOrEqual(SAFE_PEAK_DB);
  expect(entry.metrics.clipped).toBe(false);
});

// --- the creature ------------------------------------------------------------------------------------------------------------

for (const bpm of [55, 90, 130]) {
  test(`the heartbeat plays at ${bpm} bpm`, async () => {
    const period = 60 / bpm;
    const beats = 7;
    const events = Array.from({ length: beats }, (_, i) => ({ at: 0.3 + i * period, cue: "heartbeat" as const, options: { priority: true } }));
    const entry = await measure(`heartbeat-${bpm}bpm`, { seconds: 0.3 + beats * period + 0.6, events });
    const found = onsets(mixToMono(entry.result.left, entry.result.right), SAMPLE_RATE, 0.3, 0.1);
    // Each beat is a lub and a dub.
    expect(found.length, JSON.stringify(found.map((t) => Math.round(t * 1000) / 1000))).toBe(beats * 2);
    const lubs = found.filter((_, i) => i % 2 === 0);
    const measured = 60 / ((lubs[lubs.length - 1]! - lubs[0]!) / (lubs.length - 1));
    expect(Math.abs(measured - bpm) / bpm).toBeLessThan(0.03);
    // The dub follows the lub closely.
    expect(found[1]! - found[0]!).toBeGreaterThan(0.12);
    expect(found[1]! - found[0]!).toBeLessThan(0.28);
    expect(entry.metrics.peakDb).toBeLessThanOrEqual(SAFE_PEAK_DB);
  });
}

test("breath is an inhale and a rasping exhale, louder when the creature is near", async () => {
  const near = await cueEntry("breath");
  const far = await cueEntry("breath", { gain: 0.25 });
  const on = near.metrics.onsetSeconds;
  const inhale = segmentRms(near.result, on + 0.2, on + 0.5);
  const gap = segmentRms(near.result, on + 0.55, on + 0.62);
  const exhale = segmentRms(near.result, on + 0.7, on + 0.95);
  expect(gap).toBeLessThan(inhale * 0.7);
  expect(exhale).toBeGreaterThan(inhale);
  expect(near.metrics.centroidHz).toBeGreaterThan(500);
  expect(near.metrics.centroidHz).toBeLessThan(2500);
  expect(near.metrics.modulation).toBeGreaterThan(0.3);
  expect(near.metrics.rmsDb - far.metrics.rmsDb).toBeGreaterThan(8);
});

test("the creature's step is a low, heavy thud", async () => {
  const { metrics, result } = await cueEntry("monsterStep");
  const on = metrics.onsetSeconds;
  expect(metrics.centroidHz).toBeLessThan(900);
  expect(segmentFraction(result, on, on + 0.3, 40, 600)).toBeGreaterThan(0.7);
  expect(segmentRms(result, on, on + 0.05)).toBeGreaterThan(segmentRms(result, on + 0.2, on + 0.35) * 3);
});

test("the proximity warning is a low drone that rises", async () => {
  const { result } = await cueEntry("proximity");
  // It swells from the moment it starts, so measure from the start time, not from the first audible sample.
  expect(segmentFraction(result, AT + 1.2, AT + 2.2, 30, 400)).toBeGreaterThan(0.85);
  expect(segmentRms(result, AT + 1.4, AT + 2.0)).toBeGreaterThan(segmentRms(result, AT, AT + 0.6) * 3);
});

test("the rumble and the distant sounds sit where they should", async () => {
  const rumble = await cueEntry("rumble");
  expect(segmentFraction(rumble.result, rumble.metrics.onsetSeconds, rumble.metrics.endSeconds, 20, 300)).toBeGreaterThan(0.85);
  const drip = await cueEntry("drip");
  expect(drip.metrics.centroidHz).toBeGreaterThan(900);
  expect(drip.metrics.centroidHz).toBeLessThan(3500);
  const pipe = await cueEntry("pipeTick");
  expect(pipe.metrics.centroidHz).toBeGreaterThan(800);
  expect(pipe.metrics.centroidHz).toBeLessThan(4500);
  expect(pipe.metrics.peakCount).toBeGreaterThanOrEqual(2);
});

// --- the room ----------------------------------------------------------------------------------------------------------------

test("the Ouija room bed is a quiet, low, wooden room with sparse crackle", async () => {
  const bed = await measure("bed-ouija", { seconds: 9, mood: "ouija" });
  const { metrics, result } = bed;
  expect(metrics.clipped).toBe(false);
  expect(metrics.peakDb).toBeLessThan(-12);
  expect(metrics.rmsDb).toBeGreaterThan(-60);
  expect(metrics.rmsDb).toBeLessThan(-26);
  // Most of the energy is low, as in a quiet room with wood resonance.
  expect(fractionBetween(metrics, 0, 600)).toBeGreaterThan(0.6);
  // Crackle: after a high-pass, the envelope has sparse pops far above its typical level.
  const mono = mixToMono(result.left, result.right).subarray(Math.round(2 * SAMPLE_RATE));
  const pops = envelope(highPass(mono, SAMPLE_RATE, 1800), SAMPLE_RATE, 0.005);
  const sorted = [...pops].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const top = sorted[Math.floor(sorted.length * 0.995)]!;
  expect(top / median).toBeGreaterThan(5);
  expect(result.activeBedsAfter).toBe(1);
  expect(result.activeBedsDisposed).toBe(0);
});

test("the creature's closeness swells the bed", async () => {
  // At the default volume, which is where the compressor leaves the swell audible.
  const calm = await measure("bed-tension-0", { seconds: 5, mood: "tension", volume: 0.35 });
  const close = await measure("bed-tension-1", { seconds: 5, mood: "tension", volume: 0.35, tension: [{ at: 0.1, level: 1 }] });
  expect(close.metrics.rmsDb).toBeGreaterThan(calm.metrics.rmsDb + 2);
  expect(close.metrics.clipped).toBe(false);
});

test("ambient bed at full level plus a full scream stays under -3 dBFS", async () => {
  const entry = await measure(
    "scream-over-ouija-bed",
    { seconds: 3, mood: "ouija", events: [{ at: 1.2, cue: "scream", options: { priority: true } }] },
    "scream over the Ouija bed, all levels 1.0",
  );
  expect(entry.metrics.peakDb).toBeLessThanOrEqual(SAFE_PEAK_DB);
  expect(entry.metrics.clipped).toBe(false);
});

test("no page or console errors occurred in the whole run", async () => {
  expect((page as unknown as { audioErrors: string[] }).audioErrors).toEqual([]);
});
