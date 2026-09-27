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
    // Integration files share one PostgreSQL, and several suites rebuild the
    // schema in `beforeAll`, so they must not overlap. `poolOptions.forks.
    // singleFork` was the old way to say this and Vitest 4 **removed**
    // `poolOptions` entirely — the setting was silently inert, so integration
    // files ran in parallel processes and truncated each other's fixtures
    // (this cost two VS-1 lanes a red suite each). `fileParallelism: false` is
    // the supported equivalent.
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
