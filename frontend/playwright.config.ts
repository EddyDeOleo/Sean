import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a real Vite dev server and a real Sean backend on disposable repositories
 * (scripts/run_fixture_backend.py). They use the Microsoft Edge that is already installed (channel "msedge"), so no browser
 * binary is downloaded. Both servers are started and stopped by this configuration.
 */

const FRONTEND_PORT = 5273;
const BACKEND_PORT = 8865;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    channel: "msedge",
    headless: true,
    trace: "off",
    screenshot: "off",
  },
  webServer: [
    {
      command: `..\\backend\\.venv\\Scripts\\python.exe ..\\scripts\\run_fixture_backend.py --port ${BACKEND_PORT}`,
      port: BACKEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "ignore",
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      port: FRONTEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { SEAN_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}` },
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
