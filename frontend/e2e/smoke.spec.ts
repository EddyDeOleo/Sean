import { expect, test } from "@playwright/test";

test("the app opens as an engineering tool with the sidebar and one request field", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What would you like to understand?", level: 1 })).toBeVisible();
  await expect(page.getByTestId("sidebar")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Your request" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Investigate", exact: true })).toBeVisible();
});
