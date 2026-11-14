import { defineConfig } from "@playwright/test";

/**
 * The audio measurements. They render the real audio code through an OfflineAudioContext in the installed Microsoft Edge,
 * so they need only a Vite dev server: no backend. The dedicated port keeps them clear of the other end-to-end runs
 * (5273, 8865, 5173, 8000, 8001). Run with: npx playwright test -c playwright.audio.config.ts
 */

const PORT = 5373;

// The audio specs skip themselves unless this is set, so the main end-to-end configuration never runs them by accident.
process.env.SEAN_AUDIO_SUITE = "1";

export default defineConfig({
  testDir: "e2e/audio",
  testMatch: "*.spec.ts",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "msedge",
    headless: true,
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
