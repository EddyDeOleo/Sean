import { expect, test, type Page } from "@playwright/test";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEVEL } from "../../src/features/game/level";
import { begin, read, shot, walkTo } from "../helpers";

// Ports of playwright.agent.config.ts.
const SITE_PORT = 5473;
const AGENT_PORT = 8866;

test.skip(process.env.SEAN_AGENT_SUITE !== "1", "Run with playwright.agent.config.ts");

/**
 * Sean Local + Web: a production build on its own origin pairs with the agent through the Settings card, then calls it with
 * the token. The agent is the real backend on disposable repositories, started with that one web origin allowed and no
 * loopback browser origin, as scripts/start_agent.ps1 does. The pairing code is read from the agent's console, where a user
 * would read it.
 */

const SITE = `http://127.0.0.1:${SITE_PORT}`;
const AGENT = `http://127.0.0.1:${AGENT_PORT}`;
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

let agent: ChildProcess | null = null;
let output = "";
// The token from the pairing test. Disconnect forgets it only in that browser, so the later tests reuse it (a new pairing
// would wait for the 30-second start cooldown).
let pairedToken: string | null = null;
const QUESTION = "sample - Why does src/billing.py validate the amount?";

/** Start a page as a paired browser session (or a fresh one), with the game on at low cost, and record what fails. */
async function openSite(page: Page, paired: boolean): Promise<{ problems: string[] }> {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    if (response.url().startsWith(SITE) && response.status() >= 400) problems.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(SITE)) problems.push(`failed ${request.url()}`);
  });
  await page.addInitScript(
    ({ token }) => {
      if (token && window.sessionStorage.getItem("sean.agent.token.v1") === null) window.sessionStorage.setItem("sean.agent.token.v1", token);
      if (window.localStorage.getItem("sean.settings.v1") === null) {
        window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, intensity: "low", quality: "low" }));
      }
    },
    { token: paired ? pairedToken : null },
  );
  await page.goto("/");
  return { problems };
}

async function investigate(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "Your request" }).fill(QUESTION);
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
}

test.beforeAll(async () => {
  agent = spawn(
    path.join(ROOT, "backend", ".venv", "Scripts", "python.exe"),
    [path.join(ROOT, "scripts", "run_fixture_backend.py"), "--port", String(AGENT_PORT)],
    { cwd: ROOT, env: { ...process.env, SEAN_ALLOWED_ORIGINS: SITE, SEAN_LOOPBACK_ORIGINS: "none" }, stdio: ["ignore", "pipe", "pipe"] },
  );
  agent.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  agent.stderr?.on("data", () => undefined);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${AGENT}/agent/status`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The agent did not start.");
});

test.afterAll(() => {
  // The fixture runner starts uvicorn as a child process: end the whole tree.
  if (agent?.pid) spawnSync("taskkill", ["/PID", String(agent.pid), "/T", "/F"], { stdio: "ignore" });
});

async function pairingCode(): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const match = /Sean pairing code for (\S+): ([A-Z0-9]{4})-([A-Z0-9]{4})/.exec(output);
    if (match) {
      expect(match[1]).toBe(SITE);
      return `${match[2]}-${match[3]}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("No pairing code was printed.");
}

test("the web build pairs with the agent and its requests need the token", async ({ page }) => {
  // Opening the site, and visiting every page, sends nothing to the agent before the user clicks Connect.
  const agentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(AGENT)) agentRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/");
  for (const name of ["Repositories", "Saved Reports", "New Investigation", "Settings"]) {
    await page.getByRole("button", { name }).click();
  }
  const card = page.getByTestId("agent-connection");
  await expect(card).toBeVisible();
  await page.waitForTimeout(1_000);
  expect(agentRequests).toEqual([]);

  // Before pairing, the agent refuses the site's requests.
  const before = await page.evaluate(async (agentUrl) => (await fetch(`${agentUrl}/repositories`)).status, AGENT);
  expect(before).toBe(401);

  await card.getByTestId("agent-connect").click();
  const code = await pairingCode();
  await card.getByTestId("agent-code").fill(code);
  await card.getByTestId("agent-pair").click();
  await expect(card.getByTestId("agent-state")).toHaveText("Connected to the Sean agent.");

  const token = await page.evaluate(() => window.sessionStorage.getItem("sean.agent.token.v1"));
  expect(token).toBeTruthy();
  expect(await page.evaluate(() => window.localStorage.getItem("sean.agent.token.v1"))).toBeNull();

  const statuses = await page.evaluate(
    async ({ agentUrl, bearer }) => {
      const withToken = await fetch(`${agentUrl}/repositories`, { headers: { Authorization: `Bearer ${bearer}` } });
      const body = (await withToken.json()) as unknown;
      const withoutToken = await fetch(`${agentUrl}/repositories`);
      const wrongToken = await fetch(`${agentUrl}/repositories`, { headers: { Authorization: "Bearer not-a-real-token-value-000000" } });
      return { withToken: withToken.status, body: JSON.stringify(body), withoutToken: withoutToken.status, wrongToken: wrongToken.status };
    },
    { agentUrl: AGENT, bearer: token as string },
  );
  expect(statuses.withToken).toBe(200);
  expect(statuses.body).toContain("sample");
  expect(statuses.withoutToken).toBe(401);
  expect(statuses.wrongToken).toBe(401);

  // The app's own client sends the token: the Repositories view lists the agent's repositories.
  await page.getByRole("button", { name: "Repositories" }).click();
  await expect(page.getByText("sample", { exact: true }).first()).toBeVisible();

  // The agent console shows the code, never the token.
  expect(output).not.toContain(token as string);
  pairedToken = token;

  // Disconnect forgets the token in this browser.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("agent-disconnect").click();
  expect(await page.evaluate(() => window.sessionStorage.getItem("sean.agent.token.v1"))).toBeNull();
});

test("a paired site profiles a repository: the bodyless POST succeeds, and a non-JSON body is still refused", async ({ page }) => {
  expect(pairedToken).toBeTruthy();
  await openSite(page, true);
  const result = await page.evaluate(
    async ({ agentUrl, bearer }) => {
      const headers = { Authorization: `Bearer ${bearer}`, Accept: "application/json", "X-Sean-Client": "web" };
      // Exactly what advisorClient.fetchProfile sends: POST, no body, no Content-Type.
      const profile = await fetch(`${agentUrl}/repositories/sample/profile`, { method: "POST", headers, cache: "no-store" });
      const body = (await profile.json()) as { profile?: unknown; advisor?: unknown };
      const text = await fetch(`${agentUrl}/repositories/sample/profile`, { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: "x" });
      return { status: profile.status, hasProfile: body.profile !== undefined && body.advisor !== undefined, textStatus: text.status };
    },
    { agentUrl: AGENT, bearer: pairedToken as string },
  );
  expect(result).toEqual({ status: 200, hasProfile: true, textStatus: 415 });
});

test("a paired repository-level question (profile only) plays the Ouija before the game", async ({ page }) => {
  // Regression: this path has no investigation, so the profile is its only result. The agent refused the bodyless profile POST
  // with 415, the analysis ended with nothing available, and the game started without the Ouija.
  expect(pairedToken).toBeTruthy();
  const { problems } = await openSite(page, true);
  await page.getByRole("textbox", { name: "Your request" }).fill("rich - improve our engineering workflow with Kiro");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("game-intro")).toHaveCount(0);
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("after the Ouija, the first clue shows the creature and the game goes on (paired web build)", async ({ page }) => {
  expect(pairedToken).toBeTruthy();
  const { problems } = await openSite(page, true);
  await investigate(page);
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 45_000 });
  await begin(page);
  const creature = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]');
      return { visible: canvas?.dataset.creatureVisible ?? null, animation: canvas?.dataset.monsterAnimation ?? null };
    });
  await page.waitForTimeout(1_000);
  expect((await creature()).visible).toBe("false");
  expect(await walkTo(page, LEVEL.clueSpots[0]!, { gateOpen: false })).toBe(true);
  await expect(page.getByTestId("clue-counter")).toHaveText(/Clues 1 \//);
  // For sixteen seconds after the clue (the low intensity wakes it 10 s after the first clue, world.ts PROFILE): the
  // creature stays drawn, it stays in the level, and it wakes and moves on its own.
  const states = new Set<string>();
  const positions = new Set<string>();
  for (let i = 0; i < 16; i += 1) {
    const s = await read(page);
    if (!s || s.status !== "PLAYING") break;
    expect((await creature()).visible).toBe("true");
    expect(s.monsterAt.every((v) => Number.isFinite(v) && v > 0 && v < Math.max(LEVEL.width, LEVEL.height))).toBe(true);
    states.add(s.monster);
    positions.add(s.monsterAt.join(","));
    await shot(page, `paired-after-clue-${i}`);
    await page.waitForTimeout(1_000);
  }
  expect([...states].some((state) => state !== "DORMANT")).toBe(true);
  expect(positions.size).toBeGreaterThan(1);
  expect(problems).toEqual([]);
});

test("without the agent the web build starts cleanly, sends nothing to the agent, and the game still starts", async ({ page }) => {
  const agentRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(AGENT)) agentRequests.push(`${request.method()} ${request.url()}`);
  });
  const { problems } = await openSite(page, false);
  // The game's runtime model is in the build and served from the site.
  const model = await page.request.get("/models/sean-monster-250k-rigged.glb");
  expect(model.status()).toBe(200);
  expect((await model.body()).byteLength).toBeGreaterThan(1_000_000);
  await investigate(page);
  // Not connected: no request is sent, and the failure is said plainly. There is no report, and the Ouija still plays first
  // (owner decision: it is a presentation stage, not a success screen), then the game with atmosphere clues and the note.
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("game-intro")).toHaveCount(0);
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("board")).toHaveCount(0);
  await expect(page.getByTestId("analysis-error")).toBeAttached();
  await expect(page.getByTestId("game-investigation-note")).toContainText("not connected to the Sean agent");
  await expect(page.getByTestId("game-clue-source")).toContainText("not tied to any report");
  await page.getByTestId("game-begin").click();
  await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
  await expect(page.getByTestId("game-canvas")).toBeVisible();
  expect(agentRequests).toEqual([]);
  expect(problems).toEqual([]);
});

test("a paired investigation in the web build plays the Ouija before the game, with the repository analysis", async ({ page }) => {
  expect(pairedToken).toBeTruthy();
  const { problems } = await openSite(page, true);
  await investigate(page);
  // The surprise: the full-screen Ouija first, then the game's intro card.
  await expect(page.getByTestId("board")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("game-intro")).toHaveCount(0);
  await expect(page.getByTestId("planchette")).toBeVisible();
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("game-clue-source")).toContainText("Some clues come from your latest report");
  await expect(page.getByTestId("game-investigation-note")).toHaveCount(0);
  expect(problems).toEqual([]);
});

test("a site origin that is not allowed is refused before pairing", async () => {
  const response = await fetch(`${AGENT}/pair/start`, {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: "{}",
  });
  expect(response.status).toBe(403);
});
