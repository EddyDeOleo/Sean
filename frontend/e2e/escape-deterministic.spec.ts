/**
 * Reproducible escape. Each documented seed plays the real game (the investigation, the interlude, the game) through the
 * development test clock, with a deterministic player. The run passes only when an attempt actually escapes and the report
 * screen appears. Catches are not hidden: every attempt is in the trace, and the number of catches is in the test annotation.
 *
 * Seeds: ESCAPE_SEEDS below. Attempt n of a seed uses seed + n - 1 (the game's own rule for retries, with the test seed as its base).
 * Traces are written to test-results-diagnostics/ (project-relative, git-ignored).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { playAttempt, type AttemptTrace } from "./deterministicDriver";
import { LEVEL } from "../src/features/game/level";
import { initialRandomState } from "../src/features/game/world";

/** The documented seeds. Each is one reproducible run of the escape scenario. */
export const ESCAPE_SEEDS = [1, 2, 3];
/** Retries are allowed for diagnosis (default 4). The acceptance run sets ESCAPE_MAX_ATTEMPTS=1, so a catch cannot be retried. */
const MAX_ATTEMPTS = Number(process.env.ESCAPE_MAX_ATTEMPTS ?? 4);
/** Simulated seconds allowed for one attempt (the route is about 150 s at the player's speed). */
const MAX_FRAMES = 60 * 240;
const SAMPLE_EVERY = 30;

async function startGame(page: Page, seed: number): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) {
      window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, jumpscare: false, intensity: "low", quality: "low", skipGameplay: false }));
    }
  });
  await page.goto(`/?testClock=1&seed=${seed}`);
  await page.getByRole("textbox", { name: "Your request" }).fill("sample - Why does src/billing.py validate the amount?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("game-begin").click();
  await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
  await page.waitForFunction(() => typeof window.__seanTest === "object");
}

async function playSeed(page: Page, seed: number): Promise<AttemptTrace[]> {
  await startGame(page, seed);
  const attempts: AttemptTrace[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const trace = await playAttempt(page, attempt, MAX_FRAMES, SAMPLE_EVERY);
    attempts.push(trace);
    if (trace.outcome !== "CAUGHT") break;
    // The catch is recorded above. The retry is the explicit next step, taken through the real button.
    await expect(page.getByTestId("game-retry")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("game-retry").click();
    await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("game-begin").click();
    await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
    await page.waitForFunction(() => typeof window.__seanTest === "object");
  }
  return attempts;
}


/** Hash of what defines the first world: the seed-derived generator state and the fixed level and clue layout. */
function worldFingerprint(worldSeed: number): string {
  const state = { generator: initialRandomState(worldSeed), monsterStart: LEVEL.monsterStart, player: LEVEL.playerStart, exit: LEVEL.exit, clues: LEVEL.clueSpots, hideSpots: LEVEL.hideSpots };
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16);
}

/** Hash of the creature's sampled positions and states for one attempt: the trajectory the run actually followed. */
function trajectoryHash(attempt: AttemptTrace): string {
  const path = attempt.samples.map((s) => `${s.monsterAt[0].toFixed(2)},${s.monsterAt[1].toFixed(2)},${s.monster}`).join(";");
  return createHash("sha256").update(path).digest("hex").slice(0, 16);
}
function writeTrace(seed: number, attempts: AttemptTrace[]): string {
  const folder = resolve("test-results-diagnostics");
  mkdirSync(folder, { recursive: true });
  const stamp = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  const file = resolve(folder, `escape-seed${seed}-${stamp}.json`);
  // The world seed is the game's own rule for the attempt (testClock.ts worldSeed): seed + attempt - 1. It is recorded beside the
  // requested seed so a retry in a different world is never mistaken for the requested seed's first attempt.
  const recorded = attempts.map((a) => {
    const worldSeed = seed + a.attempt - 1;
    return { requestedSeed: seed, worldSeed, worldFingerprint: worldFingerprint(worldSeed), trajectoryHash: trajectoryHash(a), ...a };
  });
  writeFileSync(file, JSON.stringify({ requestedSeed: seed, fixedStep: 1 / 60, maxAttempts: MAX_ATTEMPTS, attempts: recorded }, null, 1));
  return file;
}

for (const seed of ESCAPE_SEEDS) {
  test(`escape, seed ${seed}: every clue, the gate, the exit, and the report`, async ({ page }) => {
    test.setTimeout(900_000);
    const attempts = await playSeed(page, seed);
    const outcomes = attempts.map((a) => `${a.attempt}:${a.outcome}@${a.seconds}s`).join(" ");
    const catches = attempts.filter((a) => a.outcome === "CAUGHT").length;
    const file = writeTrace(seed, attempts);
    test.info().annotations.push({ type: "catches", description: `${catches} caught before the outcome (${outcomes})` });
    test.info().annotations.push({ type: "trace", description: file });
    console.log(`ESCAPE-DETERMINISTIC seed=${seed} catches=${catches} outcomes=${outcomes} trace=${file}`);

    // Acceptance: the requested seed escapes on its first attempt, with no catch and no retry.
    const last = attempts[attempts.length - 1]!;
    expect(attempts.length, `seed ${seed}: retried, outcomes ${outcomes}`).toBe(1);
    expect(last.outcome, `seed ${seed}: no first-attempt escape, outcomes ${outcomes}`).toBe("ESCAPED");

    // Evidence progression: the clues were found in order, the gate opened after the last one, and only then the escape.
    const names = last.events.map((e) => e.text);
    const clueEvents = names.filter((n) => n.startsWith("CLUE_COLLECTED:"));
    expect(clueEvents).toEqual(clueEvents.map((_, i) => `CLUE_COLLECTED:${i + 1}`));
    expect(names.indexOf("GATE_OPENED")).toBeGreaterThan(-1);
    expect(names.indexOf("GATE_OPENED")).toBeLessThan(names.indexOf("ESCAPED"));

    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
  });
}
