/**
 * PHASE 0 shell. Playwright drives the end-to-end journeys on an emulated 360x640 Android device
 * and the HQ desktop console (TESTING.md §4).
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  retries: 0,
  use: { trace: "on-first-retry", baseURL: "http://localhost:3000" },
  projects: [
    { name: "operator-android", use: { ...devices["Pixel 7"] } },
    { name: "hq-desktop", use: { ...devices["Desktop Chrome"] } }
  ]
});
