import { defineConfig, devices } from "@playwright/test";
import { testEnv } from "./tests/setup/env";

// End-to-end tests: a real browser against a production build of the app,
// using the same Postgres, MinIO and Mailpit as the feature tests (the
// `pencil_test` database and `pencil-test` bucket). Each test signs up its
// own users, so nothing is wiped between runs.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // Migrates the test database, readies the bucket and empties Mailpit.
  globalSetup: "./tests/setup/global.ts",
  // The journeys are long and share one server; keep them in order.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Fades, page transitions and smooth scrolling are all off under reduced
    // motion, so nothing moves while a journey clicks and asserts.
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    // Locally, an already running `next start -p 3100` is reused.
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // A production build, and links in emails must point at this server.
    env: { ...testEnv, NODE_ENV: "production", APP_URL: BASE_URL },
  },
});
