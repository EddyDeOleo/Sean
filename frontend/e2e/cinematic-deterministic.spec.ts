/**
 * Deterministic capture of the caught cinematic. The real game is played through the development test clock until the
 * creature catches the player (the driver is the same one the escape tests use). Then the actual cinematic is advanced to
 * chosen moments: each moment renders exactly one frame, and the phase in the file name comes from the simulation state
 * that frame was drawn from, never from the wall clock. The defeat card's visibility is recorded at each moment too.
 *
 * Output: frontend/test-results-diagnostics/screenshots/cinematic-det/ (relative to the frontend directory).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { advance, playAttempt, setSafetyRouting } from "./deterministicDriver";

const OUT = resolve("test-results-diagnostics", "screenshots", "cinematic-det");
/** Simulated seconds after the catch at which each phase is captured (phase boundaries from cinematic.ts). */
const MOMENTS: Array<{ seconds: number; expect: string }> = [
  { seconds: 0.12, expect: "ANTICIPATION" },
  { seconds: 0.4, expect: "ACCELERATION" },
  { seconds: 0.55, expect: "LUNGE" },
  { seconds: 0.7, expect: "IMPACT" },
  { seconds: 0.95, expect: "HOLD" },
  { seconds: 1.6, expect: "DEFEAT_CARD" },
];

async function startGame(page: Page, seed: number): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) {
      window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, jumpscare: true, intensity: "low", quality: "low", skipGameplay: false }));
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

// The routing switch is module state in the driver, shared by every spec in this worker (workers: 1). Restored after the
// test, so a spec that runs next (the escape acceptance) is not played with safety routing off.
test.afterEach(() => setSafetyRouting(true));

test("the caught cinematic: each phase captured from its simulation state, with the defeat card gated", async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  await startGame(page, 1);
  // The capture needs the creature to catch the player: the cinematic plays only after a catch.
  setSafetyRouting(false);
  const attempt = await playAttempt(page, 1, 60 * 240, 60);
  expect(attempt.outcome, "the creature must catch the player to start the cinematic").toBe("CAUGHT");

  let state = await advance(page, { forward: 0, strafe: 0, turn: 0, sprint: false }, 0, true);
  const timeline: Array<Record<string, unknown>> = [];
  for (const [index, moment] of MOMENTS.entries()) {
    const elapsed = state.cinematicElapsed ?? 0;
    state = await advance(page, { forward: 0, strafe: 0, turn: 0, sprint: false }, 0, true, moment.seconds - elapsed);
    expect(state.cinematicPhase, `phase at ${moment.seconds}s`).toBe(moment.expect);
    // The defeat card is shown only when the phase is DEFEAT_CARD. Give its fade-in time to finish before the capture.
    if (state.cinematicPhase === "DEFEAT_CARD") await page.waitForTimeout(700);
    const cardVisible = await page.getByTestId("game-caught").isVisible();
    expect(cardVisible, `card visibility during ${state.cinematicPhase}`).toBe(state.cinematicPhase === "DEFEAT_CARD");
    const file = `${String(index).padStart(2, "0")}-${state.cinematicPhase}-${(state.cinematicElapsed ?? 0).toFixed(3)}s.png`;
    await page.screenshot({ path: resolve(OUT, file) });
    timeline.push({ index, file, phase: state.cinematicPhase, elapsedSeconds: state.cinematicElapsed, defeatCardVisible: cardVisible, monsterDistance: Math.hypot(state.monsterAt[0] - state.player[0], state.monsterAt[1] - state.player[1]) });
  }
  writeFileSync(resolve(OUT, "timeline.json"), JSON.stringify({ attemptOutcome: attempt.outcome, moments: timeline }, null, 1));
});
