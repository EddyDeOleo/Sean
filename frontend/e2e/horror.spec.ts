import { expect, test, type Page } from "@playwright/test";
import { LEVEL, hasLineOfSight } from "../src/features/game/level";
import { Keys, begin, enterStandalone, normalise, read, shot, walkTo } from "./helpers";

/**
 * The game is the surprise after a prompt, and a demo in Settings. These tests prove the demo runs with no backend and after a failed
 * or empty investigation, that the game never changes an investigation's status, and that the creature, the hiding places and
 * the capture behave in a real browser. No result is mocked except where a test says it breaks the network on purpose.
 */

const QUESTION = "sample - Why does src/billing.py validate the amount?";
const quiet = async (page: Page, settings: Record<string, unknown> = {}): Promise<void> => {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify(value));
  }, { horror: false, intensity: "low", quality: "low", ...settings });
};
const submit = async (page: Page, text = QUESTION): Promise<void> => {
  await page.getByRole("textbox", { name: "Your request" }).fill(text);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
};

test.describe("the game: the surprise after a prompt, and the demo in Settings", () => {
  test("the demo starts and plays with no backend at all, and leaving returns to an unchanged Sean", async ({ page }) => {
    await page.route("**/api/**", (route) => route.abort());
    await enterStandalone(page);
    await expect(page.getByTestId("game-clue-source")).toContainText("not tied to any report");
    await begin(page);
    await expect(page.getByTestId("game-canvas")).toBeVisible();
    await page.keyboard.down("KeyW");
    await expect.poll(async () => (await read(page))?.x ?? 0).toBeGreaterThan(LEVEL.playerStart.x + 0.4);
    await page.keyboard.up("KeyW");
    expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
    // Without a report every clue is fiction, and it says so.
    await expect(page.getByTestId("last-clue")).toContainText("not evidence");
    await expect(page.getByTestId("last-clue")).not.toContainText(/DOCUMENTED|INFERRED|PARTIAL/);
    await page.keyboard.press("Escape");
    await page.getByTestId("game-quit").click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    // Back in Settings, where the demo was started.
    await expect(page.getByTestId("play-demo")).toBeVisible();
  });

  test("a failed investigation keeps its error and cause, offers no game in its place, and retry works", async ({ page }) => {
    await quiet(page);
    await page.route("**/api/interpret", (route) => route.abort());
    await page.goto("/");
    await submit(page);
    const error = page.getByTestId("analysis-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("data-kind", "NETWORK");
    await expect(error).toContainText("could not be reached");
    await expect(error).toContainText("says nothing about the repository");
    // The game is the surprise after a prompt. A failure offers no game in its place.
    await expect(page.getByTestId("play-from-notice")).toHaveCount(0);
    await expect(page.getByTestId("game-intro")).toHaveCount(0);
    // Retry, once the network is back.
    await page.unroute("**/api/interpret");
    await page.getByTestId("retry-analysis").click();
    await expect(page.getByTestId("report")).toBeVisible();
    await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });

  test("after a failed investigation the demo in Settings still plays, with no report behind it", async ({ page }) => {
    await quiet(page);
    await page.route("**/api/interpret", (route) => route.abort());
    await page.goto("/");
    await submit(page);
    await expect(page.getByTestId("analysis-error")).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByTestId("play-demo").click();
    await expect(page.getByTestId("game-intro")).toBeVisible();
    await expect(page.getByTestId("game-clue-source")).toContainText("not tied to any report");
    await begin(page);
    await page.keyboard.press("Escape");
    await page.getByTestId("game-quit").click();
    await expect(page.getByTestId("game")).toHaveCount(0);
    await expect(page.getByTestId("play-demo")).toBeVisible();
  });

  test("insufficient evidence still reports INSUFFICIENT_EVIDENCE, and no game is offered from that report", async ({ page }) => {
    await quiet(page);
    await page.goto("/");
    await page.getByText("Advanced target").click();
    await page.getByLabel("Repository", { exact: true }).last().fill("sample");
    await page.getByLabel("File path").fill("src/never_existed.py");
    await page.getByLabel("Question", { exact: true }).fill("Why was it removed?");
    await page.getByRole("button", { name: "Investigate this target" }).click();
    await expect(page.getByTestId("report-classification")).toHaveText("INSUFFICIENT_EVIDENCE");
    await expect(page.getByTestId("report-conclusion")).toContainText("No conclusion");
    await expect(page.getByTestId("play-from-report")).toHaveCount(0);
  });

  test("after a successful investigation the surprise plays, the game uses the real findings, and the report is unchanged", async ({ page }) => {
    await quiet(page, { horror: true });
    await page.goto("/");
    await submit(page);
    // The surprise: the Ouija, the interruption, then the game, with the report's real findings as clues.
    await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("game-clue-source")).toContainText("Some clues come from your latest report");
    await begin(page);
    expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
    const clue = page.getByTestId("last-clue");
    await expect(clue).toContainText("DOCUMENTED");
    const text = await clue.locator(".gm-clue-text").innerText();
    expect(text.length).toBeGreaterThan(5);
    // The report is held back until the game ends. Leave, then check it.
    await page.keyboard.press("Escape");
    await page.getByTestId("game-quit").click();
    await expect(page.getByTestId("report")).toBeVisible();
    // The clue is a real record of the report, word for word.
    expect((await page.getByTestId("report").innerText())).toContain(text.replace(/…$/, ""));
    await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });
});
test.describe("the creature and the hiding places", () => {
  test("the creature has a body that can be seen, and it hunts through its states", async ({ page }) => {
    await enterStandalone(page, { intensity: "normal", quality: "medium" });
    await begin(page);
    const canvas = page.getByTestId("game-canvas");
    await shot(page, "40-creature-dormant-room");
    expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
    await expect.poll(async () => (await read(page))!.monster, { timeout: 20_000 }).not.toBe("DORMANT");
    // Face it and let it come. Wait until it is close and in front of us, then look at it.
    const keys = new Keys(page);
    let framed = false;
    const deadline = Date.now() + 70_000;
    while (Date.now() < deadline) {
      const s = await read(page);
      if (!s || s.status !== "PLAYING") break;
      const toward = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
      const d = Math.hypot(s.monsterAt[0] - s.x, s.monsterAt[1] - s.y);
      // Turn toward it, and back away slowly so it fills the view at a few tiles.
      await keys.set([Math.abs(toward) > 0.08 ? (toward > 0 ? "ArrowRight" : "ArrowLeft") : "", d < 2.2 ? "KeyS" : ""].filter(Boolean));
      const clear = hasLineOfSight(LEVEL, { x: s.x, y: s.y }, { x: s.monsterAt[0], y: s.monsterAt[1] }, false);
      if (d < 4.2 && d > 1.2 && Math.abs(toward) < 0.2 && clear) {
        await keys.release();
        await shot(page, "41-creature-close");
        framed = true;
        break;
      }
      await page.waitForTimeout(30);
    }
    await keys.release();
    expect(framed || (await page.getByTestId("game-caught").count()) > 0, "the creature came into view").toBe(true);
    expect((await canvas.screenshot()).length).toBeGreaterThan(5000);
  });

  test("hiding: E at a locker hides the player, the view narrows, and E or moving comes out", async ({ page }) => {
    await enterStandalone(page);
    await begin(page);
    const locker = LEVEL.hideSpots.find((h) => Math.hypot(h.x - LEVEL.playerStart.x, h.y - LEVEL.playerStart.y) > 3)!;
    // Not near one yet: E does nothing.
    await page.keyboard.press("KeyE");
    expect((await read(page))!.hidden).toBe(false);
    expect(await walkTo(page, { x: locker.x, y: locker.y }, { gateOpen: false })).toBe(true);
    await expect(page.getByTestId("hide-hint")).toContainText("Press E");
    await page.keyboard.press("KeyE");
    await expect(page.getByTestId("hiding-view")).toBeVisible();
    await expect(page.getByTestId("hide-hint")).toContainText("Hiding");
    expect((await read(page))!.hidden).toBe(true);
    await shot(page, "42-hiding-in-locker");
    // Walking keys while hidden bring the player out.
    await page.keyboard.down("KeyW");
    await expect.poll(async () => (await read(page))!.hidden).toBe(false);
    await page.keyboard.up("KeyW");
    await expect(page.getByTestId("hiding-view")).toHaveCount(0);
  });
});

test.describe("being caught", () => {
  async function getCaught(page: Page): Promise<void> {
    await begin(page);
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
    await expect(page.getByTestId("game-caught")).toBeVisible({ timeout: 10_000 });
  }

  test("the jumpscare shows the creature in the camera's face with a flash, then the caught screen; retry restores everything", async ({ page }) => {
    await enterStandalone(page, { jumpscare: true, quality: "medium" });
    await getCaught(page);
    await expect(page.getByTestId("jumpscare")).toBeVisible();
    await shot(page, "50-jumpscare-a");
    await page.waitForTimeout(120);
    await shot(page, "51-jumpscare-b");
    await page.waitForTimeout(700);
    await shot(page, "52-caught-screen");
    await page.getByTestId("game-retry").click();
    await expect(page.getByTestId("game-intro")).toBeVisible();
    await expect(page.getByTestId("jumpscare")).toHaveCount(0);
    await begin(page);
    // Controls work and the camera is not stuck: moving and turning both change the player.
    const start = (await read(page))!;
    await page.keyboard.down("KeyW");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ArrowRight");
    const after = (await read(page))!;
    expect(after.x).toBeGreaterThan(start.x);
    expect(after.yaw).toBeGreaterThan(start.yaw);
    expect(after.status).toBe("PLAYING");
    await expect(page.getByTestId("jumpscare")).toHaveCount(0);
    await shot(page, "53-after-retry");
  });

  test("with the scare turned off there is no flash, no close-up and no red fade, but the same capture", async ({ page }) => {
    await enterStandalone(page, { jumpscare: false });
    await getCaught(page);
    await expect(page.getByTestId("jumpscare")).toHaveCount(0);
    await expect(page.locator(".gm-whiteout")).toHaveCount(0);
    await expect(page.getByTestId("game-caught")).toContainText("You were caught");
    await shot(page, "54-caught-no-scare");
    await page.getByTestId("game-giveup").click();
    await expect(page.getByTestId("game")).toHaveCount(0);
  });
});
