import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for TripWise E2E smoke.
 *
 * Local run:
 *   1. In another terminal: bun run dev  (uses .env.local)
 *   2. Then: bunx playwright install chromium   (one-time)
 *   3. Then: bun run test:e2e
 *
 * CI wants the built app instead: BASE_URL=http://localhost:3000 and
 * assume a start command is already running.
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No global webServer — spec's demo assumes local dev server running.
  // Set PLAYWRIGHT_START_DEV=1 to auto-start `bun run dev` if you want.
  ...(process.env.PLAYWRIGHT_START_DEV
    ? {
        webServer: {
          command: "bun run dev",
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
