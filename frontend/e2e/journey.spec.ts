import { expect, test, type Page } from "@playwright/test";
import { createGame, pathActions, step, type Action } from "../src/features/escape/escapeEngine";
import { buildClues } from "../src/features/experience/clues";
import type { InvestigationResult } from "../src/types/contract";

/**
 * Browser journeys against the real backend and real disposable repositories (see playwright.config.ts).
 * Nothing here is mocked: every result comes from POST /api/investigations.
 */
async function fill(page: Page, repo: string, path: string, symbol = ""): Promise<void> {
  await page.getByLabel("Repository").fill(repo);
  await page.getByLabel("File path").fill(path);
  await page.getByLabel("Symbol (optional)").fill(symbol);
  await page.getByLabel("Your question").fill("Why does charge validate its amount?");
}
const posts = (page: Page): { count: number } => {
  const tally = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/investigations")) tally.count += 1;
  });
  return tally;
};
const summon = (page: Page) => page.getByRole("button", { name: "Summon" }).click();

test("complete journey: reveal, interruption, game played by keyboard to the exit, report", async ({ page }) => {
  const tally = posts(page);
  await page.goto("/");
  await fill(page, "sample", "src/billing.py", "charge");
  const response = page.waitForResponse((r) => r.url().includes("/api/investigations") && r.request().method() === "POST");
  await summon(page);
  const result = (await (await response).json()) as InvestigationResult;
  await expect(page.getByTestId("phrase")).toBeVisible();
  await expect(page.getByTestId("report-classification")).toHaveText(result.epistemic_classification ?? "");
  await expect(page.getByTestId("interruption")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("line-one")).toHaveText("Wait... something is wrong.");
  await expect(page.getByTestId("line-two")).toHaveText("Something else is still in this repository.", { timeout: 10_000 });
  await expect(page.getByTestId("escape")).toBeVisible({ timeout: 15_000 });
  // The evidence report stays visible and unchanged during the game.
  await expect(page.getByTestId("report-status")).toHaveText(result.retrieval_status);

  let model = createGame(result.investigation_id, buildClues(result).length);
  const keys: Record<Action, string> = { UP: "ArrowUp", DOWN: "ArrowDown", LEFT: "ArrowLeft", RIGHT: "ArrowRight", WAIT: "Space" };
  await page.getByTestId("escape").focus();
  for (let turns = 0; turns < 3000 && model.status === "PLAYING"; turns += 1) {
    const pending = model.fragments.filter((fragment) => !fragment.collected);
    const goal = pending.length > 0 ? (pending[0] as (typeof pending)[number]).at : model.exit;
    const route = pathActions(model.tiles, model.player, goal);
    const action: Action = route && route.length > 0 ? (route[0] as Action) : "WAIT";
    model = step(model, action);
    await page.keyboard.press(keys[action]);
  }
  expect(model.status).toBe("ESCAPED");
  await expect(page.getByTestId("escape")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId("report-conclusion")).toHaveText(result.conclusion ?? "");
  expect(tally.count).toBe(1);
});

test("skip paths reach the same report", async ({ page }) => {
  await page.goto("/");
  await fill(page, "sample", "src/billing.py", "charge");
  await summon(page);
  await expect(page.getByTestId("phrase")).toBeVisible();
  await page.getByTestId("skip-cinematic").click();
  await expect(page.getByTestId("interruption")).toHaveCount(0);
  await expect(page.getByTestId("report")).toBeVisible();
  const conclusion = await page.getByTestId("report-conclusion").innerText();
  await page.reload();
  await expect(page.getByTestId("report-conclusion")).toHaveText(conclusion);
  await expect(page.getByTestId("restored-note")).toBeVisible();
  await expect(page.getByTestId("interruption")).toHaveCount(0);
});

test("partial evidence keeps its limitation visible through the story", async ({ page }) => {
  await page.goto("/");
  await fill(page, "shallow", "src/billing.py");
  await summon(page);
  await expect(page.getByTestId("report-classification")).toHaveText("PARTIAL_EVIDENCE");
  await expect(page.getByTestId("partial-notice")).toBeVisible();
  await expect(page.getByTestId("interruption")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("partial-notice")).toBeVisible();
  await page.getByRole("button", { name: "Skip to the report" }).click();
  await expect(page.getByTestId("limitations")).toBeVisible();
});

test("insufficient evidence shows the neutral phrase and no story", async ({ page }) => {
  await page.goto("/");
  await fill(page, "sample", "src/never_existed.py");
  await summon(page);
  await expect(page.getByTestId("phrase")).toHaveText("INSUFFICIENT EVIDENCE");
  await page.waitForTimeout(4000);
  await expect(page.getByTestId("interruption")).toHaveCount(0);
  await expect(page.getByTestId("report-classification")).toHaveText("INSUFFICIENT_EVIDENCE");
});

test("failed retrieval shows an error, never a reveal", async ({ page }) => {
  await page.goto("/");
  await fill(page, "broken", "src/billing.py");
  await summon(page);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("phrase")).toHaveCount(0);
  await expect(page.getByTestId("interruption")).toHaveCount(0);
});

test("a rejected request is explained and never a success", async ({ page }) => {
  await page.goto("/");
  await fill(page, "missing", "src/billing.py");
  await summon(page);
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByTestId("phrase")).toHaveCount(0);
});

test("an ambiguous symbol offers candidates and sends a second, chosen request", async ({ page }) => {
  const tally = posts(page);
  await page.goto("/");
  await fill(page, "ambiguous", "src/multi.py", "run");
  await summon(page);
  const group = page.getByRole("group", { name: "Choose one definition" });
  await expect(group).toBeVisible();
  await group.getByRole("button", { name: "A.run" }).click();
  await summon(page);
  await expect(page.getByTestId("report")).toBeVisible();
  expect(tally.count).toBe(2);
});

test("invalid input is stopped before any request", async ({ page }) => {
  const tally = posts(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Summon" }).click();
  await expect(page.locator(".field-error").first()).toBeVisible();
  expect(tally.count).toBe(0);
});

test("the form can be completed and submitted with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Repository").focus();
  await page.keyboard.type("sample");
  await page.keyboard.press("Tab");
  await page.keyboard.type("src/billing.py");
  await page.keyboard.press("Tab");
  await page.keyboard.type("charge");
  await page.getByLabel("Your question").focus();
  await page.keyboard.type("Why does charge validate its amount?");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Summon" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("phrase")).toBeVisible();
});

test("cancelling a wait performs no reveal", async ({ page }) => {
  await page.route("**/api/investigations", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue().catch(() => undefined);
  });
  await page.goto("/");
  await fill(page, "sample", "src/billing.py", "charge");
  await summon(page);
  await page.getByRole("button", { name: "Stop waiting" }).click();
  await expect(page.getByTestId("cancelled")).toBeVisible();
  await page.waitForTimeout(4500);
  await expect(page.getByTestId("phrase")).toHaveCount(0);
  await expect(page.getByTestId("report")).toHaveCount(0);
});

test.describe("responsive layout", () => {
  test("390 px: zones stack and nothing overflows horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const evidence = await page.locator("[data-zone='evidence']").boundingBox();
    const board = await page.locator("[data-zone='board']").boundingBox();
    expect(evidence && board && board.y > evidence.y + evidence.height - 1).toBeTruthy();
    await fill(page, "sample", "src/billing.py", "charge");
    await summon(page);
    await expect(page.getByTestId("report")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("1280 px: Evidence & History on the left, the Ouija board on the right", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const evidence = await page.locator("[data-zone='evidence']").boundingBox();
    const board = await page.locator("[data-zone='board']").boundingBox();
    expect(evidence && board && board.x >= evidence.x + evidence.width - 1).toBeTruthy();
    expect(await page.locator("[data-zone]").count()).toBe(2);
  });
});

test("reduced motion preference is honoured and the story stays reachable", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5273/");
  await fill(page, "sample", "src/billing.py", "charge");
  await summon(page);
  await expect(page.getByTestId("interruption")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("line-one")).toBeVisible();
  const duration = await page.getByTestId("interruption").evaluate((element) => getComputedStyle(element).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
  await page.getByRole("button", { name: "Skip to the report" }).click();
  await expect(page.getByTestId("report")).toBeVisible();
  await context.close();
});
