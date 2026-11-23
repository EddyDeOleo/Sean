/**
 * Archive visual states from the running game, through the development test clock: the corridor before any evidence (no
 * monster), the corridor after the first clue with the monster dormant, and the monster hunting. Frames are saved to
 * test-results-diagnostics/screenshots/archive-states/ and the phase is read from the simulation state, not the wall clock.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { advance, decide } from "./deterministicDriver";
import { LEVEL } from "../src/features/game/level";

const OUT = resolve("test-results-diagnostics", "screenshots", "archive-states");

async function startGame(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) {
      window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, jumpscare: true, intensity: "low", quality: "low", skipGameplay: false }));
    }
  });
  await page.goto("/?testClock=1&seed=1");
  await page.getByRole("textbox", { name: "Your request" }).fill("sample - Why does src/billing.py validate the amount?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("game-begin").click();
  await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
  await page.waitForFunction(() => typeof window.__seanTest === "object");
}

test("archive states: empty corridor, dormant monster, hunting monster", async ({ page }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  await startGame(page);
  const log: Array<Record<string, unknown>> = [];

  // 1. Before any evidence: the monster is not drawn. Render the corridor at the start position.
  let s = await advance(page, { forward: 0, strafe: 0, turn: 0, sprint: false }, 1, true);
  await page.screenshot({ path: resolve(OUT, "1-empty-corridor.png") });
  log.push({ state: "empty-corridor", monsterShown: await page.locator("canvas").first().getAttribute("data-creature-visible"), phase: s.monster });

  // 2. Collect the first clue (the real route), then the monster is awake but dormant or searching.
  for (let i = 0; i < 60 * 60 && s.collected < 1; i += 1) {
    const d = decide(s, { quietFrames: 0, hidAtCollected: null });
    s = await advance(page, d.input, 1, i % 6 === 0);
  }
  s = await advance(page, { forward: 0, strafe: 0, turn: 0, sprint: false }, 0, true);
  await page.screenshot({ path: resolve(OUT, "2-monster-dormant.png") });
  log.push({ state: "dormant", collected: s.collected, monster: s.monster, visible: await page.locator("canvas").first().getAttribute("data-creature-visible") });

  // 3. Hunting in the open: the player never enters a locker (hidAtCollected pinned to the current clue count disables
  // hiding), so the creature stays in view. Capture the first frame in which it is pursuing and check it is drawn.
  for (let i = 0; i < 60 * 120 && s.monster !== "PURSUING" && s.monster !== "ATTACKING" && s.status === "PLAYING"; i += 1) {
    const d = decide(s, { quietFrames: 0, hidAtCollected: s.collected });
    s = await advance(page, d.input, 1, i % 6 === 0);
  }
  s = await advance(page, { forward: 0, strafe: 0, turn: 0, sprint: false }, 0, true);
  const shown = await page.locator("canvas").first().getAttribute("data-creature-visible");
  await page.screenshot({ path: resolve(OUT, "3-monster-hunting.png") });
  log.push({ state: "hunting", monster: s.monster, status: s.status, player: s.player, monsterAt: s.monsterAt, creatureDrawn: shown, hidden: s.hidden });
  expect(s.monster === "PURSUING" || s.monster === "ATTACKING", "the creature must be hunting").toBe(true);
  expect(shown, "the creature must be drawn in the hunting frame").toBe("true");

  writeFileSync(resolve(OUT, "states.json"), JSON.stringify(log, null, 1));
  expect(LEVEL.width).toBeGreaterThan(0);
});
