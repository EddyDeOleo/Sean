// Investigation startup scenarios. The game must start after an investigation in every outcome: success, a partial answer,
// unavailable or rate-limited backend, timeouts, malformed responses, cancellation, repeated and concurrent submissions.
// Every /api request is answered by the test (page.route), so the outcome is exact and no live Groq call is made.
// Each scenario ends at the game intro (data-testid="game-intro") or at an explicit error state. A silent success never passes.
// Timing: the interlude runs about 13 s of fixed beats before the game intro. The app's own deadlines are the advisor request
// (ADVISOR_TIMEOUT_MS, 30 s) and the investigation request (INVESTIGATION_TIMEOUT_MS, 60 s). The timeout tests wait for those.
import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { ask } from "./helpers";

type Responder = (route: Route) => Promise<void>;

const fixtureBody = (name: string): unknown =>
  (JSON.parse(readFileSync(new URL(`../tests/fixtures/${name}`, import.meta.url), "utf8")) as { body: unknown }).body;

const reply = (status: number, body: unknown): Responder => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return (route) => route.fulfill({ status, contentType: "application/json", body: text });
};
const ok = (body: unknown): Responder => reply(200, body);
const busy: Responder = reply(429, { code: "BUSY", message: "The advisor is busy. Try again in a moment.", retryable: true, field: null, candidates: [] });
const abort: Responder = (route) => route.abort();
/** Never answers. The app's own deadline is the only thing that ends the request. */
const hang: Responder = () => new Promise<void>(() => undefined);
const delayed = (ms: number, responder: Responder): Responder => async (route) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await responder(route);
};

const NO_ANSWER = { provider: "deterministic", ai_status: "NOT_REQUESTED", answer: null, evidence: [], limitations: ["Answered from the local evidence only."] };

interface Plan {
  interpret?: Responder;
  investigation?: Responder;
  profile?: Responder;
  answer?: Responder;
  capabilities?: Responder;
  repositories?: Responder;
}

/** Answers every API call the startup path makes. Returns the number of calls per endpoint. */
type Endpoint = "interpret" | "investigation" | "profile" | "answer";

async function serve(page: Page, plan: Plan = {}): Promise<Record<Endpoint, number>> {
  const calls: Record<Endpoint, number> = { interpret: 0, investigation: 0, profile: 0, answer: 0 };
  const wire = async (pattern: string, name: Endpoint | null, responder: Responder): Promise<void> => {
    await page.route(pattern, (route) => {
      if (name) calls[name] += 1;
      return responder(route);
    });
  };
  await wire("**/api/repositories", null, plan.repositories ?? ok(fixtureBody("advisor-repositories.json")));
  await wire("**/api/capabilities", null, plan.capabilities ?? ok(fixtureBody("advisor-capabilities.json")));
  await wire("**/api/interpret", "interpret", plan.interpret ?? ok(fixtureBody("advisor-interpret-investigate.json")));
  await wire("**/api/investigations", "investigation", plan.investigation ?? ok(fixtureBody("complete.json")));
  await wire("**/api/repositories/*/profile", "profile", plan.profile ?? ok(fixtureBody("advisor-profile-sample.json")));
  await wire("**/api/repositories/*/answer", "answer", plan.answer ?? ok(NO_ANSWER));
  return calls;
}

/** Every API call fails at the network level. */
const everythingDown: Plan = { interpret: abort, investigation: abort, profile: abort, answer: abort, capabilities: abort, repositories: abort };

async function startWithHorror(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem("sean.settings.v1") === null) {
      window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, intensity: "low", quality: "low", skipGameplay: false }));
    }
  });
  await page.goto("/");
}

async function expectGameIntro(page: Page, timeout = 60_000): Promise<void> {
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout });
}

/**
 * Ends the game from its intro card. After an analysis with a report, the label is "Go to the report". A game started after a
 * failed or cancelled investigation has no report, so its label is "Leave the game" and the request screen shows instead.
 */
async function leaveToReport(page: Page): Promise<void> {
  await page.getByTestId("game-intro").getByRole("button", { name: /^(Go to the report|Leave the game)$/ }).click();
}

test.describe("the game starts after an investigation, whatever its outcome", () => {
  test("a successful investigation reaches the game intro, with no technical note, and the report is kept", async ({ page }) => {
    await startWithHorror(page);
    await serve(page);
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-clue-source")).toContainText("Some clues come from your latest report");
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("report-status")).toHaveText("COMPLETE");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });

  test("a partial result (the advisor answer is invalid, the investigation succeeds) still starts the game and shows the limitation", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { answer: ok({ unexpected: true }) });
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    // The limitation is visible in the report. The investigation's own classification is unchanged by the failed answer.
    await expect(page.getByTestId("answer-missing")).toContainText("could not be validated");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });

  test("a delayed but answered investigation still reaches the game intro", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { investigation: delayed(5_000, ok(fixtureBody("complete.json"))) });
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
  });

  test("backend unavailable (every request aborted) starts the game with atmosphere clues and the technical note", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, everythingDown);
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("could not be reached");
    await expect(page.getByTestId("game-investigation-note")).toContainText("no repository finding is shown");
    await expect(page.getByTestId("game-clue-source")).toContainText("not tied to any report");
    await page.getByTestId("game-begin").click();
    await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
    await page.keyboard.press("Escape");
    await page.getByTestId("game-quit").click();
    await expect(page.getByTestId("game")).toHaveCount(0);
  });

  test("HTTP 429 BUSY on the interpret request starts the game with the status, and the error stays visible afterwards", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { interpret: busy });
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("did not accept the investigation (status 429)");
    await leaveToReport(page);
    await expect(page.getByTestId("analysis-error")).toHaveAttribute("data-kind", "REQUEST_REJECTED");
    await expect(page.getByTestId("report")).toHaveCount(0);
  });

  test("HTTP 429 BUSY on the answer endpoint does not block the investigation or the game", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { answer: busy });
    await ask(page);
    await expectGameIntro(page);
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("answer-missing")).toContainText("The advisor is busy");
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
  });

  test("a malformed (not JSON) interpret response is an explicit validation failure, and the game still starts", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { interpret: reply(200, "{not json") });
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("could not be validated");
  });

  test("a malformed investigation response is shown as not validated, the report is partial, and the game still starts", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { investigation: reply(200, "{not json") });
    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("could not be validated");
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    // With no valid investigation, the report has no classification. Its history section says why.
    await expect(page.getByTestId("report-classification")).toHaveCount(0);
    await expect(page.getByTestId("history-missing")).toContainText("could not be validated");
  });

  test("a cancelled investigation starts the game with the cancelled note, and the request screen says it was stopped", async ({ page }) => {
    await startWithHorror(page);
    await serve(page, { interpret: hang });
    await ask(page);
    await page.getByRole("button", { name: "Stop waiting", exact: true }).click();
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("was cancelled");
    await leaveToReport(page);
    await expect(page.getByTestId("cancelled")).toBeVisible();
  });

  test("the investigation has an app deadline: a request that never answers ends as a timeout, and the game still starts", async ({ page }) => {
    // INVESTIGATION_TIMEOUT_MS is 60 s in useAnalysis.ts. The wait is that deadline plus the interlude.
    test.setTimeout(170_000);
    await startWithHorror(page);
    await serve(page, { investigation: hang });
    await ask(page);
    await expectGameIntro(page, 120_000);
    await expect(page.getByTestId("game-investigation-note")).toContainText("did not answer the investigation in time");
    await expect(page.getByTestId("game-investigation-note")).toContainText("says nothing about the evidence");
  });

  test("the advisor has an app deadline: a hung answer does not hold the game, and the report says the answer was not reached", async ({ page }) => {
    // ADVISOR_TIMEOUT_MS is 30 s in advisorClient.ts. The wait is that deadline plus the interlude.
    test.setTimeout(170_000);
    await startWithHorror(page);
    await serve(page, { answer: hang });
    await ask(page);
    await expectGameIntro(page, 120_000);
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("answer-missing")).toContainText("could not be reached");
  });

  test("repeated attempts: a failed attempt, then a successful one, each reach a consistent state with no stale note", async ({ page }) => {
    await startWithHorror(page);
    let failing = true;
    const counts = await serve(page, { interpret: (route) => (failing ? busy(route) : ok(fixtureBody("advisor-interpret-investigate.json"))(route)) });

    await ask(page);
    await expectGameIntro(page);
    await expect(page.getByTestId("game-investigation-note")).toContainText("status 429");
    await leaveToReport(page);
    await expect(page.getByTestId("analysis-error")).toHaveAttribute("data-kind", "REQUEST_REJECTED");

    failing = false;
    await ask(page);
    await expectGameIntro(page);
    // The earlier failure's technical note must not carry over into the successful attempt.
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
    await expect(page.getByTestId("game-clue-source")).toContainText("Some clues come from your latest report");
    await leaveToReport(page);
    await expect(page.getByTestId("report")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("report-classification")).toHaveText("DOCUMENTED");
    expect(counts.interpret).toBe(2);
    expect(counts.investigation).toBe(1);
  });

  test("concurrent submits: a second submit while the first runs is ignored, and one request set is made", async ({ page }) => {
    await startWithHorror(page);
    const counts = await serve(page);
    await page.getByRole("textbox", { name: "Your request" }).fill("sample - Why does src/billing.py validate the amount?");
    // Two submits in the same task, before React re-renders. The second must be ignored by the analysis hook.
    await page.evaluate(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button[type=submit]")].find((b) => b.textContent === "Investigate");
      if (!button?.form) throw new Error("the Investigate form is missing");
      button.form.requestSubmit();
      button.form.requestSubmit();
    });
    await expectGameIntro(page);
    expect(counts.interpret).toBe(1);
    expect(counts.investigation).toBe(1);
    expect(counts.profile).toBe(1);
    await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
  });
});
