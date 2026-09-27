import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * E2E (T-PLAT-016, TESTING.md §2): the journeys in QA.md against the built app with seeded data.
 * Two projects — a Pixel-class mobile viewport (the primary device, DESIGN.md §4) and desktop
 * chromium. Browsers are installed in CI only (`npx playwright install --with-deps chromium`).
 */
const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // No sleeps, no real timers (T-PLAT-016): the app under test uses a seeded, frozen dataset.
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
};

// In CI the pipeline starts the app itself; locally Playwright boots `npm run dev` and waits for the
// liveness probe. `exactOptionalPropertyTypes` forbids an explicit `undefined`, hence the spread.
if (!process.env.CI) {
  config.webServer = {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  };
}

export default defineConfig(config);
