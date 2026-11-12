import { expect, test } from "@playwright/test";

test("the app loads with two zones and a form", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sean", level: 1 })).toBeVisible();
  await expect(page.locator("[data-zone='evidence']")).toBeVisible();
  await expect(page.locator("[data-zone='board']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Summon" })).toBeVisible();
});
