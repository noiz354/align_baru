// @ts-check
/**
 * Playwright config — E2E.
 *
 * Task: T-FOUND-001. TEST_STRATEGY.md §1: E2E runs against the real app in
 * compose, with axe-core as the a11y gate (NFR-A11Y-001). A touched route must
 * be axe-clean, so the axe check is part of the E2E run, not a separate command.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env['E2E_PORT'] ?? 3100);
const BASE_URL = process.env['E2E_BASE_URL'] ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Convention, pinned rather than left to Playwright's default
  // (`*.@(spec|test).ts`): every runnable E2E spec is `*.e2e.spec.ts`, full
  // stop. Until F-021-S1 this directory also held seven `*.e2e.test.ts` files
  // of Vitest `describe.todo` placeholders, which neither runner executed —
  // vitest's `include` covers only tests/unit and tests/integration, and this
  // matcher excluded them — so they were planning debt wearing a test file's
  // name. Their IDs live in TEST_STRATEGY.md and TASKS.md, which is where
  // planned work belongs; the files are deleted, and this comment is the
  // receipt. When a planned E2E lands, it lands directly as a `*.e2e.spec.ts`.
  testMatch: '**/*.e2e.spec.ts',
  // A flake blocks the milestone; zero tolerance (AGENTS.md §3). One retry in CI
  // to absorb genuine infrastructure races, none locally so a local flake is loud.
  retries: process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  reporter: process.env['CI']
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-results/e2e-junit.xml' }],
      ]
    : [['list']],
  outputDir: 'test-results/e2e-artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // The reader's 320px minimum (reader-behavior.md §2) needs a narrow gate.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  // Bring the app up in CI; locally the developer runs `docker compose -f
  // docker/docker-compose.dev.yml up` (T-FOUND-010) and reuses the server.
  webServer: process.env['CI']
    ? {
        command: 'npm run start -- --port ' + PORT,
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
