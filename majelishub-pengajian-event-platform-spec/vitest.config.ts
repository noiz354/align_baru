/**
 * Vitest 4 workspace configuration.
 *
 * Four projects, one per test layer (TESTING.md §2):
 *   unit        pure domain/application/contract tests, no I/O
 *   integration real PostgreSQL, isolated database per suite
 *   browser     Vitest browser mode with the Playwright provider (real DOM, scanner/recorder/editor)
 *   e2e         handled by Playwright itself (playwright.config.ts), not by Vitest
 *
 * State (2026-09-27): the `unit` and `integration` projects run. `@/` resolves to `src/` (the same alias
 * `tsconfig.json` declares), integration tests connect to a real PostgreSQL - see
 * `tests/support/db.ts` for the PGlite default and the `INTEGRATION_DATABASE_URL` container path.
 * Still TODO(T-TEST-001): the browser provider, container lifecycle with an isolated schema per suite,
 * the seed generator and flaky detection.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcAlias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias: srcAlias },
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // TODO(T-TEST-001): fixed clock, seeded ids, no network guard
        },
      },
      {
        resolve: { alias: srcAlias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          pool: "forks",
          // Each suite creates its own database (tests/support/db.ts); no state is shared between files.
          // TODO(T-TEST-001): container lifecycle, isolated schema per suite, fixture seeding
        },
      },
      {
        resolve: { alias: srcAlias },
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          // TODO(T-TEST-001): @vitest/browser-playwright provider, chromium (+ webkit subset)
        },
      },
    ],
  },
});
