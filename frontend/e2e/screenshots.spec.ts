import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { test, type Page } from "@playwright/test";

/**
 * Visual inspection aid, not an assertion suite. It drives the real application against the real backend and saves
 * screenshots to a temporary folder so the design can be reviewed by eye. The behavior assertions live in journey.spec.ts.
 */
const OUT = process.env.SEAN_SHOT_DIR ?? resolve(process.env.TEMP ?? ".", "sean-shots");

async function ask(page: Page, sentence: string): Promise<void> {
  await page.getByRole("textbox", { name: "Your request" }).fill(sentence);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
}
const shot = (page: Page, name: string, fullPage = false) => page.screenshot({ path: resolve(OUT, `${name}.png`), fullPage });

test("capture the Ouija and the interruption", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, skipGameplay: true })));
  await page.goto("/");
  await ask(page, "sample - Why does src/billing.py validate the amount?");
  await page.getByTestId("board").waitFor();
  await page.waitForTimeout(2200);
  await shot(page, "20-ouija-intro");
  await page.waitForTimeout(2500);
  await shot(page, "21-ouija-planchette-moving");
  await page.getByTestId("line-one").waitFor({ timeout: 15000 });
  await shot(page, "22-interruption-line-one");
  await page.getByTestId("line-two").waitFor({ timeout: 10000 });
  await shot(page, "23-interruption-line-two");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "24-ouija-mobile");
});

test("capture the product screens", async ({ page }) => {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
  });
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 900 });

  await page.goto("/");
  await shot(page, "01-home");
  await page.getByText("Advanced target").click();
  await shot(page, "02-home-advanced");

  await page.route("**/api/repositories/*/profile", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.goto("/");
  await ask(page, "sample - Why does src/billing.py validate the amount?");
  await page.getByTestId("progress").waitFor();
  await shot(page, "03-progress");
  await page.getByTestId("report").waitFor();
  await page.unroute("**/api/repositories/*/profile");
  await shot(page, "04-report-top");
  await page.getByTestId("section-history").scrollIntoViewIfNeeded();
  await shot(page, "05-report-history");

  await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
  await ask(page, "rich - Analyze this repository and identify opportunities to improve its engineering workflow with Kiro.");
  await page.getByTestId("report").waitFor();
  await page.getByTestId("section-overview").scrollIntoViewIfNeeded();
  await shot(page, "06-report-overview-rich");
  await page.getByTestId("section-findings").scrollIntoViewIfNeeded();
  await shot(page, "07-report-findings-rich");
  await page.locator('[data-testid="recommendation"][data-capability="BUGFIX_SPECS"] summary').click();
  await page.getByTestId("section-advisor").scrollIntoViewIfNeeded();
  await shot(page, "08-advisor-rich");
  await page.locator('[data-testid="recommendation"][data-capability="BUGFIX_SPECS"]').scrollIntoViewIfNeeded();
  await shot(page, "09-advisor-detail-rich");
  const steering = page.locator('[data-testid="recommendation"][data-capability="STEERING"]');
  await steering.locator("summary").click();
  await steering.getByTestId("prepare").click();
  await steering.getByTestId("artifact-file").waitFor();
  await steering.getByTestId("artifact-file").scrollIntoViewIfNeeded();
  await shot(page, "09b-artifact-preview");
  await page.getByTestId("section-roadmap").scrollIntoViewIfNeeded();
  await shot(page, "10-roadmap-rich");
  await page.getByTestId("section-transparency").scrollIntoViewIfNeeded();
  await shot(page, "11-transparency");

  await page.getByRole("button", { name: "Saved Reports" }).click();
  await shot(page, "12-saved-reports");
  await page.getByRole("button", { name: "Repositories" }).click();
  await shot(page, "13-repositories");
  await page.getByRole("button", { name: "Settings" }).click();
  await shot(page, "14-settings");
  await page.getByTestId("sidebar-toggle").click();
  await shot(page, "15-collapsed-sidebar");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await shot(page, "16-mobile-home");
  await page.getByRole("button", { name: "Menu" }).click();
  await shot(page, "17-mobile-drawer");
  await page.getByRole("button", { name: "Saved Reports" }).click();
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByTestId("report").waitFor();
  await shot(page, "18-mobile-report");
  await page.getByTestId("section-advisor").scrollIntoViewIfNeeded();
  await shot(page, "19-mobile-advisor");
});
