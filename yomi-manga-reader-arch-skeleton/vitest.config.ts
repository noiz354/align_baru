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
    // `NODE_ENV` is pinned HERE, not in a test file and not in CI, because the
    // suite must give the same answer whoever runs it. Vitest does not set this
    // value, so without the pin it is inherited from the invoking shell — and a
    // shell that happens to export `NODE_ENV=production` makes `loadEnv()`
    // correctly refuse to boot over `http://` (NFR-SEC-009), after which
    // `app/media/[assetKey]/route.ts` turns the boot failure into a §6 500 by
    // design. The result is four phantom failures in media-delivery that look
    // like a production defect and are not one; they were reported as exactly
    // that on 2026-09-28 and nearly produced a remediation for a bug that does
    // not exist. CI has always set `NODE_ENV=test`
    // (.github/workflows/project-checks.yml:108) and was never red.
    //
    // This does not weaken the production rule: it scopes to the Vitest process
    // only. `next build` and `next start` do not read it, and a dev server over
    // http:// in production mode still refuses to start, which is the point of
    // NFR-SEC-009.
    env: { NODE_ENV: 'test' },
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
