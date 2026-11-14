import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Repository management on the existing Repositories page, against the real backend (the fixture backend has its own temporary
 * registry file) and real Git repositories created on disk for each test. Nothing is mocked except the one test that breaks the
 * network on purpose. The backend's rules are tested in depth in backend/tests/unit/test_repository_management.py.
 */

const SHOTS = process.env.SEAN_SHOT_DIR ?? null;
const shot = async (page: Page, name: string): Promise<void> => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
};

let counter = 0;
const unique = (): string => `e2e${Date.now().toString(36)}${(counter += 1)}`;

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd, stdio: "ignore" });
}

/** A small real Git repository in a temporary folder. */
function makeRepository(): { path: string; file: string; before: string } {
  const root = mkdtempSync(join(tmpdir(), "sean-e2e-repo-"));
  git(root, "init", "-q", ".");
  mkdirSync(join(root, "src"));
  const file = join(root, "src", "app.py");
  writeFileSync(file, "def run():\n    return 1\n", "utf-8");
  git(root, "add", ".");
  git(root, "commit", "-q", "-m", "Add app");
  writeFileSync(file, "def run():\n    return 2\n", "utf-8");
  git(root, "commit", "-q", "-am", "Fix the return value");
  return { path: root, file, before: snapshotOf(root) };
}

/** Every file name and size outside .git/objects churn, so a test can prove nothing changed. */
function snapshotOf(root: string): string {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
      else out.push(`${prefix}${entry.name}:${readFileSync(join(dir, entry.name)).length}`);
    }
  };
  walk(root, "");
  return out.sort().join("\n");
}

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Repositories" }).click();
  await expect(page.getByTestId("repositories")).toBeVisible();
}

async function add(page: Page, name: string, id: string, path: string): Promise<void> {
  if ((await page.getByTestId("repository-form").count()) === 0) await page.getByTestId("add-repository").click();
  await page.getByTestId("field-display-name").fill(name);
  await page.getByTestId("field-repository-id").fill(id);
  await page.getByTestId("field-path").fill(path);
  await page.getByTestId("repository-submit").click();
}

const row = (page: Page, id: string) => page.locator(`[data-testid="repository-row"][data-repository-id="${id}"]`);

test("the page lists the repositories that are registered, with name, identifier, folder and status", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("repository-row")).not.toHaveCount(0);
  const first = page.getByTestId("repository-row").first();
  await expect(first.locator("h2")).not.toBeEmpty();
  await expect(first.getByTestId("repository-path")).toContainText(":\\");
  await expect(first).toContainText("AVAILABLE");
  await shot(page, "60-repositories-list");
});

test("adding a repository registers it at once, without restarting anything, and it can be investigated immediately", async ({ page }) => {
  const repo = makeRepository();
  const id = unique();
  await open(page);
  await page.getByTestId("add-repository").click();
  await shot(page, "61-repositories-add-form");
  await page.getByTestId("field-display-name").fill("My Project");
  await expect(page.getByTestId("field-repository-id")).toHaveValue("my-project");
  await page.getByTestId("field-repository-id").fill(id);
  // Paste exactly what Explorer's "Copy as path" gives: the path in quotes.
  await page.getByTestId("field-path").fill(`"${repo.path}"`);
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("repositories-status")).toContainText("Added My Project");
  await expect(row(page, id)).toBeVisible();
  await expect(row(page, id)).toContainText("My Project");
  await expect(row(page, id).getByTestId("repository-path")).toContainText(repo.path);
  await expect(row(page, id)).toContainText("AVAILABLE");
  await shot(page, "62-repositories-added");

  // Use it straight away.
  await row(page, id).getByTestId("use-repository").click();
  await expect(page.locator("select").first()).toHaveValue(id);
  await page.getByRole("textbox", { name: "Your request" }).fill("Why does src/app.py exist?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("report")).toBeVisible();
  await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
  await expect(page.getByTestId("report")).toContainText("Fix the return value");

  // The registration survives a reload (it is in the backend's registry, not in the page).
  await page.reload();
  await page.getByRole("button", { name: "Repositories" }).click();
  await expect(row(page, id)).toBeVisible();
  expect(snapshotOf(repo.path)).toBe(repo.before);
});

test("bad input is explained next to the field and nothing is registered", async ({ page }) => {
  const repo = makeRepository();
  const plain = mkdtempSync(join(tmpdir(), "sean-e2e-plain-"));
  const id = unique();
  await open(page);
  const count = await page.getByTestId("repository-row").count();

  await add(page, "Missing", unique(), join(tmpdir(), "sean-does-not-exist-12345"));
  await expect(page.getByTestId("error-path")).toContainText(/No folder exists/);

  await page.getByTestId("field-path").fill(plain);
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("error-path")).toContainText(/Git/);

  await page.getByTestId("field-path").fill(join(repo.path, "src"));
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("error-path")).toContainText(/Git|root|top/i);

  await page.getByTestId("field-path").fill("relative\\path");
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("error-path")).toContainText(/drive letter/);
  await shot(page, "63-repositories-error");

  await page.getByTestId("field-display-name").fill("Good");
  await page.getByTestId("field-repository-id").fill("Not Valid!");
  await page.getByTestId("field-path").fill(repo.path);
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("error-repository_id")).toBeVisible();

  await page.getByTestId("field-repository-id").fill(id);
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("repositories-status")).toContainText("Added Good");
  expect(await page.getByTestId("repository-row").count()).toBe(count + 1);
});

test("a duplicate identifier and a duplicate folder, however it is spelled, are refused and the originals are untouched", async ({ page }) => {
  const repo = makeRepository();
  const other = makeRepository();
  const id = unique();
  await open(page);
  await add(page, "Original", id, repo.path);
  await expect(row(page, id)).toBeVisible();

  await add(page, "Same id", id, other.path);
  await expect(page.getByTestId("error-repository_id")).toContainText(/already/i);

  const variants = [
    repo.path.toUpperCase(),
    `${repo.path}\\`,
    repo.path.replace(/\\/g, "/"),
    `${repo.path}\\src\\..`,
    `${repo.path}\\.`,
  ];
  for (const variant of variants) {
    await page.getByTestId("field-repository-id").fill(unique());
    await page.getByTestId("field-path").fill(variant);
    await page.getByTestId("repository-submit").click();
    await expect(page.getByTestId("repository-form"), `variant ${variant}`).toBeVisible();
    await expect(page.getByTestId("error-path"), `variant ${variant}`).toBeVisible();
  }
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(row(page, id).getByTestId("repository-path")).toContainText(repo.path);
});

test("editing changes the name and the folder, the identifier stays, and the same folder can be kept", async ({ page }) => {
  const a = makeRepository();
  const b = makeRepository();
  const id = unique();
  await open(page);
  await add(page, "Before", id, a.path);
  await expect(row(page, id)).toBeVisible();
  await row(page, id).getByTestId("edit-repository").click();
  await expect(page.getByTestId("field-repository-id")).toHaveAttribute("readonly", "");
  await page.getByTestId("field-display-name").fill("After");
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("repositories-status")).toContainText("Saved After");
  await expect(row(page, id)).toContainText("After");
  await expect(row(page, id).getByTestId("repository-path")).toContainText(a.path);

  await row(page, id).getByTestId("edit-repository").click();
  await page.getByTestId("field-path").fill("C:\\sean-no-such-folder-98765");
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("error-path")).toBeVisible();
  await page.getByTestId("field-path").fill(b.path);
  await page.getByTestId("repository-submit").click();
  await expect(row(page, id).getByTestId("repository-path")).toContainText(b.path);
  expect(snapshotOf(a.path)).toBe(a.before);
  expect(snapshotOf(b.path)).toBe(b.before);
});

test("removing asks first, removes only the registration, never the folder, and the repository can no longer be used", async ({ page }) => {
  const repo = makeRepository();
  const id = unique();
  await open(page);
  await add(page, "To remove", id, repo.path);
  await expect(row(page, id)).toBeVisible();

  await row(page, id).getByTestId("remove-repository").click();
  await expect(page.getByTestId("remove-confirm")).toContainText("not touched");
  await shot(page, "64-repositories-remove-confirm");
  await page.getByTestId("keep-repository").click();
  await expect(row(page, id)).toBeVisible();

  await row(page, id).getByTestId("remove-repository").click();
  await page.getByTestId("confirm-remove").click();
  await expect(row(page, id)).toHaveCount(0);
  await expect(page.getByTestId("repositories-status")).toContainText("Its folder was not touched");

  // The folder, its history and its files are exactly as they were.
  expect(existsSync(join(repo.path, ".git"))).toBe(true);
  expect(readFileSync(repo.file, "utf-8")).toBe("def run():\n    return 2\n");
  expect(snapshotOf(repo.path)).toBe(repo.before);

  // It is gone for investigations too, at once.
  await page.getByTestId("sidebar").getByRole("button", { name: "New Investigation" }).click();
  await page.getByRole("textbox", { name: "Your request" }).fill(`${id} - Why does src/app.py exist?`);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("analysis-error")).toBeVisible();
  await expect(page.getByTestId("report")).toHaveCount(0);
});

test("a backend error while saving is shown, nothing changes on screen, and the page keeps working", async ({ page }) => {
  const repo = makeRepository();
  await open(page);
  const count = await page.getByTestId("repository-row").count();
  await page.route("**/api/repositories", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "REGISTRY_UNAVAILABLE", message: "The registry could not be written.", retryable: true }) });
    else await route.continue();
  });
  await add(page, "Will fail", unique(), repo.path);
  await expect(page.getByTestId("repository-form-error")).toContainText("registry could not be written");
  await expect(page.getByTestId("repository-form")).toBeVisible();
  expect(await page.getByTestId("repository-row").count()).toBe(count);
  await page.unroute("**/api/repositories");
  await page.getByTestId("repository-submit").click();
  await expect(page.getByTestId("repositories-status")).toContainText("Added Will fail");
});

test("the page works on a narrow screen and by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false })));
  await page.goto("/");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByTestId("sidebar").getByRole("button", { name: "Repositories" }).click();
  await expect(page.getByTestId("repositories")).toBeVisible();
  await page.getByTestId("add-repository").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("field-display-name")).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, "65-repositories-mobile");
});
