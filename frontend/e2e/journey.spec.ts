import { expect, test, type Page } from "@playwright/test";

/**
 * Browser journeys against the real backend and real disposable repositories (see playwright.config.ts).
 * Nothing is mocked: every result comes from the running backend, and reports are saved in the browser's real IndexedDB.
 */
async function ask(page: Page, sentence: string): Promise<void> {
  await page.getByRole("textbox", { name: "Your request" }).fill(sentence);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
}
/** Most journeys test the report, so the narrative experience is off for them. Its own tests turn it on. */
const quietSettings = async (page: Page, settings: Record<string, unknown> = { horror: false }): Promise<void> => {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify(value));
  }, settings);
};
test.beforeEach(async ({ page }) => {
  await quietSettings(page);
});
const posts = (page: Page, fragment: string): { count: number } => {
  const tally = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes(fragment)) tally.count += 1;
  });
  return tally;
};

test("a natural-language request returns a unified report from the real repository", async ({ page }) => {
  const investigations = posts(page, "/api/investigations");
  const profiles = posts(page, "/profile");
  await page.goto("/");
  await ask(page, "sample - Why does src/billing.py validate the amount?");
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
  await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  await expect(page.getByTestId("report-conclusion")).toContainText("5 commit");
  for (const id of ["section-overview", "section-history", "section-findings", "section-advisor", "section-roadmap", "section-transparency"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("report")).toHaveAttribute("data-origin", "fresh");
  expect(investigations.count).toBe(1);
  expect(profiles.count).toBe(1);
});

test("the Advisor gives repository-specific recommendations with evidence, and says what it does not recommend", async ({ page }) => {
  await page.goto("/");
  await ask(page, "rich - Analyze this repository and identify opportunities to improve its engineering workflow with Kiro.");
  await expect(page.getByTestId("section-advisor")).toBeVisible();
  const adopt = page.locator('[data-testid="recommendation"][data-status="ADOPT_NOW"]');
  await expect(adopt).toHaveCount(4);
  for (const capability of ["STEERING", "SPECS", "BUGFIX_SPECS", "KIROIGNORE"]) {
    await expect(page.locator(`[data-testid="recommendation"][data-capability="${capability}"][data-status="ADOPT_NOW"]`)).toHaveCount(1);
  }
  const bugfix = page.locator('[data-testid="recommendation"][data-capability="BUGFIX_SPECS"]');
  await bugfix.locator("summary").click();
  await expect(bugfix.getByTestId("rec-evidence")).toContainText("fix-labelled");
  await expect(bugfix).toContainText("INFERRED");
  await expect(page.getByTestId("roadmap-immediate")).toContainText("Steering");
  await expect(page.locator('[data-testid="recommendation"][data-capability="PERMISSIONS"]')).toContainText("Your user settings (not a repository file)");
  // The repository without such signals gets a different, shorter answer.
  await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
  await ask(page, "sample - Which Kiro capabilities would help this repository?");
  await expect(page.getByTestId("section-advisor")).toBeVisible();
  await expect(page.locator('[data-testid="recommendation"][data-status="ADOPT_NOW"]')).toHaveCount(0);
  await expect(page.getByTestId("no-actionable")).toBeVisible();
});

test("a report is saved and reopened after a reload as a saved snapshot", async ({ page }) => {
  await page.goto("/");
  await ask(page, "sample - Why does src/billing.py validate the amount?");
  await expect(page.getByTestId("report")).toBeVisible();
  const conclusion = await page.getByTestId("report-conclusion").innerText();
  await page.reload();
  await expect(page.getByTestId("report")).toHaveCount(0);
  await expect(page.getByTestId("recent").getByRole("button")).toHaveCount(1);
  await page.getByTestId("recent").getByRole("button").first().click();
  await expect(page.getByTestId("report")).toHaveAttribute("data-origin", "saved");
  await expect(page.getByTestId("report-conclusion")).toHaveText(conclusion);
  await page.getByRole("button", { name: "Saved Reports" }).click();
  await expect(page.getByTestId("saved-row")).toHaveCount(1);
});

test("a request without a file offers real files and never guesses", async ({ page }) => {
  await page.goto("/");
  await ask(page, "rich - Why was the payments logic introduced?");
  const group = page.getByTestId("file-candidates");
  await expect(group).toBeVisible();
  await expect(group.getByRole("button", { name: "api/payments.py" })).toBeVisible();
  await expect(page.getByTestId("report")).toHaveCount(0);
  await group.getByRole("button", { name: "api/payments.py" }).click();
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByTestId("report-classification")).toHaveText(/DOCUMENTED|INFERRED/);
});

test("ambiguous symbols are offered as choices", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Advanced target").click();
  await page.getByLabel("Repository", { exact: true }).last().fill("ambiguous");
  await page.getByLabel("File path").fill("src/multi.py");
  await page.getByLabel("Symbol (optional)").fill("run");
  await page.getByLabel("Question", { exact: true }).fill("Why does run exist?");
  await page.getByRole("button", { name: "Investigate this target" }).click();
  const group = page.getByTestId("symbol-candidates");
  await expect(group).toBeVisible();
  await group.getByRole("button", { name: "A.run" }).click();
  await expect(page.getByTestId("report")).toBeVisible();
});

test("insufficient evidence shows no conclusion", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Advanced target").click();
  await page.getByLabel("Repository", { exact: true }).last().fill("sample");
  await page.getByLabel("File path").fill("src/never_existed.py");
  await page.getByLabel("Question", { exact: true }).fill("Why was it removed?");
  await page.getByRole("button", { name: "Investigate this target" }).click();
  await expect(page.getByTestId("report-classification")).toHaveText("INSUFFICIENT_EVIDENCE");
  await expect(page.getByTestId("report-conclusion")).toContainText("No conclusion");
});

test("a broken repository is an error, never a report", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Advanced target").click();
  await page.getByLabel("Repository", { exact: true }).last().fill("broken");
  await page.getByLabel("File path").fill("src/billing.py");
  await page.getByLabel("Question", { exact: true }).fill("Why?");
  await page.getByRole("button", { name: "Investigate this target" }).click();
  await expect(page.getByTestId("analysis-error")).toBeVisible();
  await expect(page.getByTestId("report")).toHaveCount(0);
});

test("an unregistered repository is explained", async ({ page }) => {
  await page.goto("/");
  await ask(page, "https://github.com/company/project - Explain the authentication architecture");
  await expect(page.getByTestId("analysis-error")).toContainText("does not clone");
  await expect(page.getByTestId("report")).toHaveCount(0);
});

test("invalid input is stopped before any request", async ({ page }) => {
  const interpret = posts(page, "/api/interpret");
  await page.goto("/");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("Describe what you want");
  expect(interpret.count).toBe(0);
});

test("stopping the wait shows no report", async ({ page }) => {
  await page.route("**/api/repositories/*/profile", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue().catch(() => undefined);
  });
  await page.goto("/");
  await ask(page, "sample - Why does src/billing.py validate the amount?");
  await page.getByRole("button", { name: "Stop waiting" }).click();
  await expect(page.getByTestId("cancelled")).toBeVisible();
  await page.waitForTimeout(4000);
  await expect(page.getByTestId("report")).toHaveCount(0);
});

test("the whole flow works with the keyboard alone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your request" }).focus();
  await page.keyboard.type("sample - Why does src/billing.py validate the amount?");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByTestId("report")).toBeVisible();
  await page.getByRole("link", { name: "Kiro Advisor" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("section-advisor")).toBeInViewport();
});

test.describe("layout", () => {
  test("1280 px: the sidebar is visible, collapses, and the choice is remembered", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const open = await page.getByTestId("sidebar").boundingBox();
    expect(open!.width).toBeGreaterThan(200);
    await page.getByTestId("sidebar-toggle").click();
    await expect.poll(async () => (await page.getByTestId("sidebar").boundingBox())!.width).toBeLessThan(100);
    await page.reload();
    expect((await page.getByTestId("sidebar").boundingBox())!.width).toBeLessThan(100);
  });

  test("390 px: navigation is a drawer and nothing overflows horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("sidebar")).not.toBeInViewport();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByTestId("sidebar")).toBeInViewport();
    await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
    await ask(page, "rich - improve our engineering workflow with Kiro");
    await expect(page.getByTestId("report")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("reduced motion preference is honoured", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:5273/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("motion-status")).toHaveText("Motion is reduced.");
  await context.close();
});

test("the backend refuses requests that come from another website", async ({ request }) => {
  const evil = await request.get("http://127.0.0.1:8865/repositories", { headers: { origin: "https://evil.example" } });
  expect(evil.status()).toBe(403);
  const rebinding = await request.get("http://127.0.0.1:8865/repositories", { headers: { host: "evil.example" } });
  expect(rebinding.status()).toBe(403);
  const local = await request.get("http://127.0.0.1:8865/repositories", { headers: { origin: "http://127.0.0.1:5273" } });
  expect(local.status()).toBe(200);
});

test("a prepared steering file downloads with its real name and can be checked against the repository", async ({ page }) => {
  await page.goto("/");
  await ask(page, "rich - Analyze this repository and identify opportunities to improve its engineering workflow with Kiro.");
  const card = page.locator('[data-testid="recommendation"][data-capability="STEERING"]');
  await card.locator("summary").click();
  await card.getByTestId("prepare").click();
  const file = card.getByTestId("artifact-file");
  await expect(file).toBeVisible();
  await expect(file).toContainText("FORMAT VALID");
  const [download] = await Promise.all([page.waitForEvent("download"), file.getByRole("button", { name: "Download" }).click()]);
  expect(download.suggestedFilename()).toBe("project-conventions.md");
  await expect(file.getByTestId("artifact-note")).toContainText("Downloaded");
  await expect(card.locator("summary")).toContainText("EXPORTED");
  await file.getByTestId("check-committed").click();
  await expect(file.getByTestId("artifact-note")).not.toContainText("Downloaded");
  await expect(file.getByTestId("artifact-note")).not.toHaveText("");
  await expect(card).not.toContainText(/applied/i);
});

test.describe("the narrative interlude", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, skipGameplay: true })));
  });

  test("covers the screen after a successful analysis, says it is fiction, and ends at the unchanged report", async ({ page }) => {
    await page.goto("/");
    await ask(page, "sample - Why does src/billing.py validate the amount?");
    const overlay = page.getByTestId("interlude");
    await expect(overlay).toBeVisible();
    await expect(page.getByTestId("fiction-notice")).toContainText("cannot change your report");
    await expect(page.getByTestId("board")).toBeVisible();
    await expect(page.getByTestId("report")).toHaveCount(0);
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
    await expect(page.getByTestId("line-one")).toHaveText("Wait... something is wrong.", { timeout: 15000 });
    await expect(page.getByTestId("line-two")).toHaveText("Something else is still in this repository.", { timeout: 10000 });
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("interlude")).toHaveCount(0);
    await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });

  test("can be skipped with the button or Escape and the report is the same", async ({ page }) => {
    await page.goto("/");
    await ask(page, "sample - Why does src/billing.py validate the amount?");
    await page.getByTestId("skip-interlude").click();
    await expect(page.getByTestId("report")).toBeVisible();
    const conclusion = await page.getByTestId("report-conclusion").innerText();
    await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
    await ask(page, "sample - Why does src/billing.py validate the amount?");
    await expect(page.getByTestId("interlude")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("report")).toBeVisible();
    await expect(page.getByTestId("report-conclusion")).toHaveText(conclusion);
  });

  test("never appears for insufficient evidence, a failure, or a saved report", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Advanced target").click();
    await page.getByLabel("Repository", { exact: true }).last().fill("sample");
    await page.getByLabel("File path").fill("src/never_existed.py");
    await page.getByLabel("Question", { exact: true }).fill("Why was it removed?");
    await page.getByRole("button", { name: "Investigate this target" }).click();
    await expect(page.getByTestId("report-classification")).toHaveText("INSUFFICIENT_EVIDENCE");
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("interlude")).toHaveCount(0);
    await page.reload();
    await page.getByTestId("recent").getByRole("button").first().click();
    await expect(page.getByTestId("report")).toHaveAttribute("data-origin", "saved");
    await expect(page.getByTestId("interlude")).toHaveCount(0);
  });

  test("reduced motion shows a static board", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, skipGameplay: true })));
    await page.goto("http://127.0.0.1:5273/");
    await ask(page, "sample - Why does src/billing.py validate the amount?");
    await expect(page.getByTestId("interlude")).toHaveAttribute("data-reduced", "true");
    await expect(page.getByTestId("line-one")).toBeVisible({ timeout: 6000 });
    await context.close();
  });
});
