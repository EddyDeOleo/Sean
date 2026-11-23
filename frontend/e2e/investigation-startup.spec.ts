// Investigation startup, end to end, without playing the game: the request sequence (status and duration only, never answer
// text), and the time at which the narrative interlude and the game intro appear. A permanent diagnostic: it documents how
// long the pre-game path takes, so the game tests' wait budget can be compared with the real duration.
import { test, expect } from "@playwright/test";
import { ask } from "./helpers";

interface Call {
  method: string;
  path: string;
  status: number | null;
  ms: number | null;
}

test("the investigation request sequence and the time to the game intro", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) {
      window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, intensity: "low", quality: "low", skipGameplay: false }));
    }
  });
  const calls: Call[] = [];
  const pending = new Map<string, { started: number; call: Call }>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Backend calls go through the dev server's /api proxy. Only their method, path, status and time are recorded.
    if (!url.pathname.startsWith("/api/")) return;
    const path = url.pathname.replace(/^\/api/, "").replace(/\/repositories\/[^/]+/, "/repositories/{id}");
    const call: Call = { method: request.method(), path, status: null, ms: null };
    calls.push(call);
    pending.set(request.url() + request.method(), { started: Date.now(), call });
  });
  page.on("response", (response) => {
    const key = response.request().url() + response.request().method();
    const entry = pending.get(key);
    if (!entry) return;
    entry.call.status = response.status();
    entry.call.ms = Date.now() - entry.started;
    pending.delete(key);
  });
  const t0 = Date.now();
  const at = (): number => Date.now() - t0;
  const marks: Record<string, number> = {};
  await page.goto("/");
  await ask(page);
  marks.investigateClicked = at();
  await expect(page.getByTestId("interlude")).toBeVisible({ timeout: 60_000 });
  marks.interludeVisible = at();
  await expect(page.getByText("Wait... something is wrong.")).toBeVisible({ timeout: 60_000 });
  marks.firstInterludeLine = at();
  await expect(page.getByTestId("game-begin")).toBeVisible({ timeout: 90_000 });
  marks.gameIntroVisible = at();
  // A request that never completed is recorded as such, so a hang is visible in the report rather than hidden.
  const unfinished = [...pending.values()].map((entry) => `${entry.call.method} ${entry.call.path}`);
  await testInfo.attach("startup-timing.json", {
    body: JSON.stringify({ marks, calls, unfinished }, null, 1),
    contentType: "application/json",
  });
  console.log(`STARTUP marks=${JSON.stringify(marks)} calls=${JSON.stringify(calls.map((c) => `${c.method} ${c.path} ${c.status} ${c.ms}ms`))} unfinished=${unfinished.length}`);
  expect(unfinished).toEqual([]);
});
