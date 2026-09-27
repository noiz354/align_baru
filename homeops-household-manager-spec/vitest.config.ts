import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Test projects (T-PLAT-016, TESTING.md §2):
 *  - `unit`        node environment, no database, no wall clock (TP-2, TP-5)
 *  - `integration` node environment against a scratch Postgres; skipped when DATABASE_URL is absent
 *
 * The browser/component project (Vitest Browser Mode) lands with the first UI slice that needs it
 * (VS-4, T-DASH-002); adding it now would install Playwright browsers for zero coverage.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Integration tests share one scratch database, so the integration script runs with
    // `--no-file-parallelism` (TESTING.md §4); Vitest 4 exposes that as a CLI flag, not a config key.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          environment: 'node',
          globals: false,
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globals: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
