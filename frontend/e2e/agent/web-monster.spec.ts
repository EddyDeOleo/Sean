import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { LEVEL, hasLineOfSight } from "../../src/features/game/level";
import { Keys, begin, normalise, read, shot, walkTo } from "../helpers";

test.skip(process.env.SEAN_AGENT_SUITE !== "1", "Run with playwright.agent.config.ts");

/**
 * The game in the web build, as Netlify serves it: the production bundle under the response headers of netlify.toml (the
 * Content-Security-Policy included), which `vite preview` does not apply by itself. Set SEAN_PREVIEW_URL to run the same
 * checks against a real deploy preview instead.
 */
const PREVIEW = process.env.SEAN_PREVIEW_URL ?? null;

/** The headers netlify.toml sets for every path. */
function netlifyHeaders(): Record<string, string> {
  const toml = readFileSync(new URL("../../../netlify.toml", import.meta.url), "utf8");
  const headers: Record<string, string> = {};
  for (const match of toml.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"([^"]*)"\s*$/gm)) {
    if (["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy"].includes(match[1]!)) headers[match[1]!] = match[2]!;
  }
  expect(Object.keys(headers)).toHaveLength(3);
  return headers;
}

async function openAsDeployed(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`failed: ${request.url()}`));
  if (process.env.SEAN_REDUCED_MOTION) await page.emulateMedia({ reducedMotion: "reduce" });
  if (!PREVIEW) {
    const headers = netlifyHeaders();
    await page.route("**/*", async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
    });
  }
  // SEAN_DEFAULT_SETTINGS: a first visit, with every setting at its default (as on a new site origin).
  const settings = process.env.SEAN_DEFAULT_SETTINGS ? {} : { horror: true, intensity: "low", quality: "low" };
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify(value));
  }, settings);
  await page.goto(PREVIEW ?? "/");
  return problems;
}

const creature = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]');
    const root = document.querySelector<HTMLElement>('[data-testid="game"]');
    return { visible: canvas?.dataset.creatureVisible ?? null, animation: canvas?.dataset.monsterAnimation ?? null, state: root?.dataset.monster ?? null };
  });

test("the creature appears with the first clue and stays drawn, in the web build under the site's headers", async ({ page }) => {
  const problems = await openAsDeployed(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await startDemo(page);
  await begin(page);
  // Hidden until the first fragment, by design.
  await page.waitForTimeout(1_500);
  expect((await creature(page)).visible).toBe("false");
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  await expect(page.getByTestId("clue-counter")).toHaveText(/Clues 1 \//);
  await expect.poll(async () => (await creature(page)).visible, { timeout: 10_000 }).toBe("true");
  // Face it and let it come, as horror.spec.ts does, until it is a few tiles away in clear view.
  await expect.poll(async () => (await read(page))!.monster, { timeout: 20_000 }).not.toBe("DORMANT");
  const keys = new Keys(page);
  let framed = false;
  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline) {
    const s = await read(page);
    if (!s || s.status !== "PLAYING") break;
    const toward = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
    const d = Math.hypot(s.monsterAt[0] - s.x, s.monsterAt[1] - s.y);
    await keys.set([Math.abs(toward) > 0.08 ? (toward > 0 ? "ArrowRight" : "ArrowLeft") : "", d < 2.2 ? "KeyS" : ""].filter(Boolean));
    const clear = hasLineOfSight(LEVEL, { x: s.x, y: s.y }, { x: s.monsterAt[0], y: s.monsterAt[1] }, false);
    if (d < 4.2 && d > 1.2 && Math.abs(toward) < 0.2 && clear) {
      await keys.release();
      const now = await creature(page);
      expect(now.visible).toBe("true");
      expect(["IDLE", "WALKING", "RUNNING", "ANTICIPATION", "LUNGE", "HOLD", "RECOVERY"]).toContain(now.animation);
      await shot(page, "web-creature-close");
      framed = true;
      break;
    }
    await page.waitForTimeout(30);
  }
  await keys.release();
  // Caught before it could be framed also proves it came for the player; the caught screen must then appear.
  expect(framed || (await page.getByTestId("game-caught").count()) > 0, "the creature came into view").toBe(true);
  expect(problems).toEqual([]);
});

/** The demo from Settings: the Ouija first (board, then the interruption), and only then the game's intro card. */
async function startDemo(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("play-demo").click();
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("game-intro")).toHaveCount(0);
  await expect(page.getByTestId("line-two")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("board")).toHaveCount(0);
}

/** Walk into the creature until it catches the player. */
async function getCaught(page: Page): Promise<void> {
  const keys = new Keys(page);
  const deadline = Date.now() + 60_000;
  try {
    while (Date.now() < deadline && (await page.getByTestId("game-caught").count()) === 0) {
      const s = await read(page);
      if (!s || s.status !== "PLAYING") break;
      const diff = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
      await keys.set([Math.abs(diff) > 0.1 ? (diff > 0 ? "ArrowRight" : "ArrowLeft") : "", "KeyW"].filter(Boolean));
      await page.waitForTimeout(30);
    }
  } finally {
    await keys.release();
  }
}

/** The defeat card exactly as designed, actually visible (not only in the DOM), with both choices usable. */
async function expectCaughtCard(page: Page, leaveLabel: string): Promise<void> {
  const card = page.getByTestId("game-caught");
  // The scare plays first; the card is gated by the cinematic's DEFEAT_CARD phase (game.css) and fades in after 1.4 s.
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("game")).toHaveAttribute("data-cinematic-phase", "DEFEAT_CARD");
  await expect(card.getByRole("heading", { name: "You were caught" })).toBeVisible();
  await expect(card).toContainText("This is part of the fiction. Your report is unchanged.");
  await expect(card.getByTestId("game-retry")).toHaveText("Try again");
  await expect(card.getByTestId("game-giveup")).toHaveText(leaveLabel);
  await expect(card.getByTestId("game-retry")).toBeEnabled();
  await expect(card.getByTestId("game-giveup")).toBeEnabled();
  await expect.poll(async () => Number(await card.evaluate((el) => getComputedStyle(el).opacity)), { timeout: 3_000 }).toBeGreaterThan(0.95);
}

test("caught after the first clue: the defeat card appears, and Try again starts a clean new attempt (web build)", async ({ page }) => {
  const problems = await openAsDeployed(page);
  await startDemo(page);
  await begin(page);
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  await expect.poll(async () => (await creature(page)).visible, { timeout: 10_000 }).toBe("true");
  await getCaught(page);
  await expect(page.getByTestId("jumpscare")).toBeAttached();
  await expectCaughtCard(page, "Give up and leave");
  await shot(page, "web-caught-card");
  await page.getByTestId("game-retry").click();
  // A new attempt: back to the intro card (no second Ouija), then a fresh world.
  await expect(page.getByTestId("game-intro")).toBeVisible();
  await expect(page.getByTestId("board")).toHaveCount(0);
  await expect(page.getByTestId("game")).toHaveAttribute("data-attempt", "2");
  await begin(page);
  await expect(page.getByTestId("clue-counter")).toHaveText(/Clues 0 \//);
  expect((await read(page))!.monster).toBe("DORMANT");
  expect((await creature(page)).visible).toBe("false");
  await expect(page.getByTestId("game-caught")).toHaveCount(0);
  // The new attempt plays: the first clue shows the creature again.
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  await expect.poll(async () => (await creature(page)).visible, { timeout: 10_000 }).toBe("true");
  expect(problems).toEqual([]);
});

test("caught: Give up and leave ends the game and returns to Sean, without restarting it (web build)", async ({ page }) => {
  const problems = await openAsDeployed(page);
  await startDemo(page);
  await begin(page);
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  await getCaught(page);
  await expectCaughtCard(page, "Give up and leave");
  await page.getByTestId("game-giveup").click();
  await expect(page.getByTestId("interlude")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId("game")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("play-demo")).toBeVisible();
  await page.waitForTimeout(2_000);
  await expect(page.getByTestId("game-intro")).toHaveCount(0);
  expect(problems).toEqual([]);
});