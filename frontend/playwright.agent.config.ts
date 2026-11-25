import { defineConfig } from "@playwright/test";

/**
 * The Sean Local + Web pairing test (docs/development/d05-local-web-deployment-decision-record.md). It serves a production
 * build (vite preview) on its own origin, so the site talks to the agent directly with CORS and a bearer token, exactly as the
 * Netlify site does. The spec starts the agent itself (scripts/run_fixture_backend.py) to read the pairing code from its
 * console. Ports 5473 and 8866 keep it clear of the other runs (5173, 5273, 5373, 8000, 8865).
 * Run with: npx playwright test -c playwright.agent.config.ts
 *
 * The build writes frontend/dist with the test agent address; run `npm run build` afterwards for a normal bundle.
 */

const SITE_PORT = 5473;
const AGENT_PORT = 8866;

// The spec skips itself unless this is set, so the main end-to-end configuration never runs it.
process.env.SEAN_AGENT_SUITE = "1";

export default defineConfig({
  testDir: "e2e/agent",
  testMatch: "*.spec.ts",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${SITE_PORT}`,
    channel: "msedge",
    headless: true,
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: `npx vite build && npx vite preview --port ${SITE_PORT} --strictPort`,
    port: SITE_PORT,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_SEAN_AGENT_URL: `http://127.0.0.1:${AGENT_PORT}` },
    stdout: "ignore",
    stderr: "ignore",
  },
});
