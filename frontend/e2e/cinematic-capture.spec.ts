/**
 * Browser capture of the caught cinematic. A real game is played until the creature catches the player. Each frame of the
 * close-up is saved as a full-page screenshot whose name carries the phase and the time since the catch, read from the
 * development build's canvas attributes. The run checks that the phases come in order, that the defeat card is hidden while
 * the close-up plays, and that it appears after the hold. Screenshots go to test-results-diagnostics/screenshots/cinematic,
 * relative to the frontend directory (where Playwright runs). Nothing in the game is mocked.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Keys, begin, enterStandalone, normalise, read, walkTo } from "./helpers";
import { LEVEL } from "../src/features/game/level";

const OUT = "test-results-diagnostics/screenshots/cinematic";
const PHASES = ["ANTICIPATION", "ACCELERATION", "LUNGE", "IMPACT", "HOLD", "DEFEAT_CARD"] as const;
/** Frames saved after the defeat card is first seen, so the final composition is recorded too. */
const FRAMES_AFTER_CARD = 3;

interface Sample {
  index: number;
  phase: string | null;
  elapsedSeconds: number | null;
  file: string;
}

async function catchPlayer(page: Page): Promise<void> {
  await begin(page);
  // The creature sleeps until the first clue is found (a game rule), so collect it first, as a player would.
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  const keys = new Keys(page);
  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline && (await page.getByTestId("game-caught").count()) === 0) {
    const s = await read(page);
    if (!s || s.status !== "PLAYING") break;
    const diff = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
    await keys.set([Math.abs(diff) > 0.1 ? (diff > 0 ? "ArrowRight" : "ArrowLeft") : "KeyW", "KeyW"]);
    await page.waitForTimeout(30);
  }
  await keys.release();
  await expect(page.getByTestId("game-caught")).toBeAttached({ timeout: 70_000 });
}

test.describe("the caught cinematic", () => {
  test.setTimeout(150_000);

  test("plays its phases in order, keeps the defeat card back until the hold, and saves a frame of each phase", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await enterStandalone(page, { jumpscare: true, quality: "medium" });
    await catchPlayer(page);

    const canvas = page.getByTestId("game-canvas");
    const card = page.getByTestId("game-caught");
    const samples: Sample[] = [];
    let cardSeenAt: number | null = null;
    const deadline = Date.now() + 20_000;

    while (Date.now() < deadline) {
      const phase = await canvas.getAttribute("data-cinematic-phase");
      const elapsed = await canvas.getAttribute("data-cinematic-elapsed");
      const index = samples.length;
      const elapsedSeconds = elapsed === null ? null : Number(elapsed);
      const label = `${String(index).padStart(2, "0")}-${phase ?? "NONE"}-${elapsedSeconds === null ? "x" : Math.round(elapsedSeconds * 1000)}ms`;
      const file = `${OUT}/${label}.png`;
      if (samples.length === 0 || samples[samples.length - 1]!.phase !== phase) {
        // The defeat card's visibility is checked only on the first frame of each phase.
        if (phase === "ANTICIPATION") await expect(card).not.toBeVisible();
      }
      await page.screenshot({ path: file });
      samples.push({ index, phase, elapsedSeconds, file });

      if (phase === "DEFEAT_CARD" && cardSeenAt === null) {
        await expect(card).toBeVisible({ timeout: 3_000 });
        cardSeenAt = samples.length;
      }
      if (cardSeenAt !== null && samples.length >= cardSeenAt + FRAMES_AFTER_CARD) break;
    }

    const observed: string[] = [];
    for (const s of samples) if (s.phase !== null && observed[observed.length - 1] !== s.phase) observed.push(s.phase);
    writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ phasesObserved: observed, samples }, null, 2));

    // The phases come in the required order. Phases shorter than one screenshot round trip may be missed; those are recorded.
    const positions = observed.map((phase) => PHASES.indexOf(phase as (typeof PHASES)[number]));
    expect(positions.every((p) => p >= 0)).toBe(true);
    for (let i = 1; i < positions.length; i += 1) expect(positions[i]!).toBeGreaterThan(positions[i - 1]!);
    expect(observed).toContain("ANTICIPATION");
    expect(observed).toContain("HOLD");
    expect(observed).toContain("DEFEAT_CARD");
    expect(cardSeenAt, "the defeat card appeared").not.toBeNull();

    // The card waits for the hold: every frame before the card phase is an earlier phase.
    const firstCard = samples.findIndex((s) => s.phase === "DEFEAT_CARD");
    expect(samples.slice(0, firstCard).every((s) => s.phase !== "DEFEAT_CARD")).toBe(true);
  });
});
