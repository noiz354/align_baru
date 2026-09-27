/**
 * Vitest 4 workspace configuration (T-TEST-001).
 *
 * Three projects, one per test layer (TESTING.md §2):
 *   unit         pure domain/application/contract tests, no I/O
 *   integration  real PostgreSQL — embedded (PGlite) today, containerised PostgreSQL 18 once
 *                T-TEST-001 wires the compose stack
 *   browser      Vitest browser mode with the Playwright provider (real DOM, scanner/recorder/editor)
 *
 * e2e is handled by Playwright itself (playwright.config.ts), not by Vitest.
 *
 * What is real now (T-ORG-001) and what is still to come (T-TEST-001):
 *   done   the `@/` path alias, so a test can import the module it exercises
 *   done   migration-backed fixtures: `tests/support/database.ts` builds an embedded PostgreSQL from
 *          the committed SQL in `drizzle/`, so an integration suite runs with no Docker
 *   TODO   fixed clock and seeded ids, a no-network guard, isolated schema per suite, and the
 *          browser-mode provider
 */
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * `@/` is the alias used throughout `src/` and `tests/` (tsconfig.json paths).
 *
 * It is repeated inside every project because a project in a Vitest workspace does not inherit the
 * root `resolve` block — and without it no test can import the code it is testing.
 */
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * Environment for tests.
 *
 * `BETTER_AUTH_SECRET` is required at boot by the auth configuration, so every suite needs *a* value.
 * This one is synthetic and committed on purpose: it is a test fixture, never a deployment secret
 * (NFR-SEC-011 — a real secret must never enter the repository).
 */
const env = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-only-value-never-a-deployment-secret",
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          env,
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // TODO(T-TEST-001): fixed clock, seeded ids, no network guard
        },
      },
      {
        resolve: { alias },
        test: {
          env,
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          pool: "forks",
          // Each suite builds its own embedded database (tests/support/database.ts), so suites are
          // isolated by construction. TODO(T-TEST-001): offer containerised PostgreSQL 18 for CI.
        },
      },
      {
        resolve: { alias },
        test: {
          env,
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          // TODO(T-TEST-001): @vitest/browser-playwright provider, chromium (+ webkit subset)
        },
      },
    ],
  },
});
