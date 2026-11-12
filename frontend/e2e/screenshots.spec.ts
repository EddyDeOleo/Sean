import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Visual inspection aid, not an assertion suite. It drives the real journey and saves screenshots to a temporary folder so
 * the art direction can be reviewed by eye. The behavior assertions live in journey.spec.ts.
 */

const OUT = process.env.SEAN_SHOT_DIR ?? resolve(process.env.TEMP ?? ".", "sean-shots");

async function fill(page: Page, repo: string, path: string, symbol = ""): Promise<void> {
  await page.getByLabel("Repository").fill(repo);
  await page.getByLabel("File path").fill(path);
  if (symbol) await page.getByLabel("Symbol (optional)").fill(symbol);
  await page.getByLabel("Your question").fill("Why does charge validate its amount?");
}

test("capture the journey", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("/");
  await page.screenshot({ path: resolve(OUT, "1-setup.png"), fullPage: true });

  await fill(page, "sample", "src/billing.py", "charge");
  await page.getByRole("button", { name: "Summon" }).click();
  await expect(page.getByTestId("stage-text")).toContainText("searches", { timeout: 10_000 }).catch(() => undefined);
  await page.screenshot({ path: resolve(OUT, "2-searching.png"), fullPage: true });

  await expect(page.getByTestId("phrase")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: resolve(OUT, "3-revealed.png"), fullPage: true });

  await expect(page.getByTestId("interruption")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: resolve(OUT, "4-interruption.png"), fullPage: true });

  await expect(page.getByTestId("escape")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: resolve(OUT, "5-escape.png"), fullPage: true });

  await page.getByRole("button", { name: "Skip the game" }).click();
  await expect(page.getByTestId("report")).toBeVisible();
  await page.screenshot({ path: resolve(OUT, "6-report.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(OUT, "7-mobile-report.png"), fullPage: true });
});
