// @ts-check
/**
 * Vitest config — unit + integration.
 *
 * Task: T-FOUND-001. TEST_STRATEGY.md §1 separates the two levels:
 * - unit        → tests/unit,  no I/O, no services
 * - integration → tests/integration, real PostgreSQL + MinIO via compose
 *
 * E2E (tests/e2e) is Playwright's job, not Vitest's — see playwright.config.ts.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Unit is the default; integration is opt-in so `npm run test:unit` never
    // needs Docker (AGENTS.md §3: narrowest relevant verification first).
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    // Skeleton tests are `describe.todo`; they report as skipped, not passed.
    passWithNoTests: false,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'test-results/vitest-junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      // Changed-line coverage is the DoD gate (T-PERF-003 owns the CI wiring).
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: ['**/*.d.ts', 'src/app/**', 'tests/**', '_docs/**'],
    },
    // Integration tests share one Postgres schema; run them serially so
    // migrations and fixtures cannot interleave.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
