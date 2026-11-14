import { expect, test } from "@playwright/test";
import { LEVEL } from "../src/features/game/level";
import { Keys, ask, begin, enterGame, normalise, read, shot, walkTo } from "./helpers";

test("the game starts after the interruption, draws a real 3D scene and shows what to do", async ({ page }) => {
  await enterGame(page);
  await shot(page, "30-game-intro");
  await expect(page.getByTestId("game-intro")).toContainText("Collect every clue");
  await expect(page.getByTestId("game-intro")).toContainText("fiction");
  await begin(page);
  await expect(page.getByTestId("clue-counter")).toHaveText(/Clues 0 \/ [3-5]/);
  const canvas = page.getByTestId("game-canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(viewport.width - 2);
  const before = await canvas.screenshot();
  expect(before.length).toBeGreaterThan(4000); // a black frame compresses to almost nothing
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowRight");
  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  await shot(page, "31-game-first-person");
});

test("the flashlight toggles, pause stops the world, and quitting goes to the unchanged report", async ({ page }) => {
  await enterGame(page);
  await begin(page);
  await expect(page.getByTestId("flashlight-status")).toContainText("on");
  await page.keyboard.press("KeyF");
  await expect(page.getByTestId("flashlight-status")).toContainText("off");
  await page.keyboard.press("KeyF");
  await expect(page.getByTestId("flashlight-status")).toContainText("on");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("game-paused")).toBeVisible();
  await shot(page, "32-game-paused");
  const frozen = await read(page);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  expect(await read(page)).toEqual(frozen);
  await page.getByTestId("game-resume").click();
  await expect(page.getByTestId("game-paused")).toHaveCount(0);

  await page.keyboard.down("KeyW");
  await expect.poll(async () => (await read(page))!.x).toBeGreaterThan(frozen!.x + 0.3);
  await page.keyboard.up("KeyW");

  await page.keyboard.press("Escape");
  await page.getByTestId("game-quit").click();
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
  await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
});

test("walls stop the player", async ({ page }) => {
  await enterGame(page);
  await begin(page);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(3000);
  await page.keyboard.up("KeyW");
  const s = (await read(page))!;
  // Facing +x from (1.5, 1.5) the first wall is the column at x = 4.
  expect(s.x).toBeLessThan(4 - 0.2);
  expect(s.x).toBeGreaterThan(3);
});

test("collecting a clue shows the real evidence with its label and wakes the threat", async ({ page }) => {
  await enterGame(page);
  await begin(page);
  const total = Number((await page.getByTestId("clue-counter").innerText()).match(/\/ (\d+)/)![1]);
  const first = LEVEL.clueSpots[0]!;
  expect((await read(page))!.monster).toBe("DORMANT");
  expect(await walkTo(page, first, { gateOpen: false })).toBe(true);
  await expect(page.getByTestId("clue-counter")).toHaveText(`Clues 1 / ${total}`);
  const clue = page.getByTestId("last-clue");
  await expect(clue).toBeVisible();
  await expect(clue).toContainText(/DOCUMENTED|INFERRED|PARTIAL EVIDENCE/);
  await expect(clue).not.toContainText("not evidence");
  await expect.poll(async () => (await read(page))!.monster).not.toBe("DORMANT");
  await shot(page, "33-game-clue");
});

test("the creature catches a player who walks into it, and the player can retry or give up", async ({ page }) => {
  await enterGame(page, { jumpscare: true });
  await begin(page);
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  // Walk toward wherever it is until it catches us.
  const keys = new Keys(page);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && (await page.getByTestId("game-caught").count()) === 0) {
    const s = await read(page);
    if (!s || s.status !== "PLAYING") break;
    const diff = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
    const wanted = [Math.abs(diff) > 0.1 ? (diff > 0 ? "ArrowRight" : "ArrowLeft") : "", "KeyW"].filter(Boolean);
    await keys.set(wanted);
    await page.waitForTimeout(30);
  }
  await keys.release();
  await expect(page.getByTestId("game-caught")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("jumpscare")).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, "34-game-caught");
  await page.getByTestId("game-retry").click();
  await expect(page.getByTestId("game-intro")).toBeVisible();
  await expect(page.getByTestId("game")).toHaveAttribute("data-attempt", "2");
  await begin(page);
  await expect(page.getByTestId("clue-counter")).toHaveText(/Clues 0 \//);
  expect((await read(page))!.monster).toBe("DORMANT");
  await page.keyboard.press("Escape");
  await page.getByTestId("game-quit").click();
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 10_000 });
});

test("the jumpscare can be turned off", async ({ page }) => {
  await enterGame(page, { jumpscare: false });
  await begin(page);
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  const keys = new Keys(page);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && (await page.getByTestId("game-caught").count()) === 0) {
    const s = await read(page);
    if (!s || s.status !== "PLAYING") break;
    const diff = normalise(Math.atan2(s.monsterAt[1] - s.y, s.monsterAt[0] - s.x) - s.yaw);
    await keys.set([Math.abs(diff) > 0.1 ? (diff > 0 ? "ArrowRight" : "ArrowLeft") : "KeyW", "KeyW"]);
    await page.waitForTimeout(30);
  }
  await keys.release();
  await expect(page.getByTestId("game-caught")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("jumpscare")).toHaveCount(0);
  await page.getByTestId("game-giveup").click();
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 10_000 });
});

test("a player who collects every clue and reaches the exit escapes to the report", async ({ page }) => {
  test.setTimeout(480_000);
  await enterGame(page);
  await begin(page);
  const total = Number((await page.getByTestId("clue-counter").innerText()).match(/\/ (\d+)/)![1]);
  const spots = Array.from({ length: total }, (_, i) => LEVEL.clueSpots[Math.floor((i * LEVEL.clueSpots.length) / total) % LEVEL.clueSpots.length]!);
  let attempts = 0;
  let escaped = false;
  while (!escaped && attempts < 6) {
    attempts += 1;
    let alive = true;
    for (const spot of spots) {
      if (!(await walkTo(page, spot, { gateOpen: false, sprint: true, careful: true }))) {
        const s = await read(page);
        console.log(`attempt ${attempts}: stopped going to ${spot.x},${spot.y}: ${JSON.stringify(s)}`);
        alive = false;
        break;
      }
    }
    if (alive) {
      await expect(page.getByTestId("clue-counter")).toHaveText(`Clues ${total} / ${total}`);
      await expect(page.getByText("The gate is open. Find the green exit.").first()).toBeVisible();
      await shot(page, "35-game-gate-open");
      alive = await walkTo(page, LEVEL.exit, { gateOpen: true, sprint: true, careful: true });
    }
    // Reaching the exit ends the game at once, so the game's attributes disappear while the walk is still running.
    if (!alive && (await read(page)) === null && (await page.getByTestId("game-caught").count()) === 0) alive = true;
    if (alive) {
      escaped = true;
    } else if ((await page.getByTestId("game-caught").count()) > 0) {
      await page.getByTestId("game-retry").click();
      await begin(page);
    } else break;
  }
  expect(escaped, `escaped after ${attempts} attempt(s)`).toBe(true);
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("game")).toHaveCount(0);
});

test("leaving the game leaves no canvas and no animation loop behind", async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    (window as unknown as { __raf: number }).__raf = 0;
    window.requestAnimationFrame = (cb) => {
      (window as unknown as { __raf: number }).__raf += 1;
      return original(cb);
    };
  });
  await enterGame(page);
  await begin(page);
  await page.waitForTimeout(500);
  expect(await page.locator("canvas").count()).toBe(1);
  await page.keyboard.press("Escape");
  await page.getByTestId("game-quit").click();
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("canvas")).toHaveCount(0);
  const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
  // The report may use a few frames for layout; a running game loop would add dozens in this time.
  expect(b - a).toBeLessThan(5);
});

test("without WebGL the report opens and says nothing false", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return (original as (...a: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof original;
  });
  await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, quality: "low" })));
  await page.goto("/");
  await ask(page);
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("game")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByTestId("game-note")).toContainText("could not run");
  await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
});

test("sound is on by default, plays through the game without errors, and the user can turn it off", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, intensity: "low", quality: "low" })));
  await page.goto("/");
  await expect(page.getByTestId("sound-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  // Sound is on by default. The click on Settings is the first gesture in the page, so it has started.
  await expect(page.getByTestId("sound-status")).toHaveText("Sound is on.");
  await page.getByTestId("mute").check();
  await expect(page.getByTestId("sound-status")).toHaveText("Sound is on but muted.");
  await page.getByTestId("mute").uncheck();
  await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
  await ask(page);
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("game-sound")).toContainText("on");
  await begin(page);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForTimeout(1200);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyF");
  await page.keyboard.press("Escape");
  await page.getByTestId("game-quit").click();
  await expect(page.getByTestId("report")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("sound-toggle").click();
  await expect(page.getByTestId("sound-status")).toHaveText("Sound is off.");
  expect(problems.filter((p) => !/favicon|Failed to load resource/i.test(p))).toEqual([]);
});
