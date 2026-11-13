import { defineConfig, devices } from "@playwright/test";

const PORT = 3121;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  // The DPR bug is invisible at 1x and certain at 2x, so every browser check runs on both.
  projects: [
    {
      name: "retina",
      use: { ...devices["Desktop Chrome"], deviceScaleFactor: 2 },
    },
    { name: "1x", use: { ...devices["Desktop Chrome"], deviceScaleFactor: 1 } },
  ],
  webServer: {
    // A production build in its own folder, so it never replaces the real one; loopback only.
    command: `node scripts/fetch-fonts.mjs && next build && next start -H 127.0.0.1 -p ${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
