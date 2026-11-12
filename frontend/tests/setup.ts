import { afterEach } from "vitest";

// Component tests render into document.body. Clean it, and reset storage, between tests.
afterEach(async () => {
  const { cleanup } = await import("./renderHelpers");
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
