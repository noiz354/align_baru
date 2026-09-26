/**
 * Vitest 4 workspace configuration - PHASE 0 SKELETON (T-TEST-001).
 *
 * Four projects, one per test layer (TESTING.md §2):
 *   unit        pure domain/application/contract tests, no I/O
 *   integration real PostgreSQL (and MinIO) containers, isolated schema per suite
 *   browser     Vitest browser mode with the Playwright provider (real DOM, scanner/recorder/editor)
 *   e2e         handled by Playwright itself (playwright.config.ts), not by Vitest
 *
 * Phase 0: no runner is installed, so this file documents the intended projects and the rules that
 * matter (no network, fixed clock, deterministic seeds, isolated schemas). Implementing it is part of
 * T-TEST-001 and is the VS-0 exit criterion "test commands run".
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          // TODO(T-TEST-001): fixed clock, seeded ids, no network guard
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          pool: "forks",
          // TODO(T-TEST-001): start containers, apply migrations, isolated schema per suite
        },
      },
      {
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.ts"],
          // TODO(T-TEST-001): @vitest/browser-playwright provider, chromium (+ webkit subset)
        },
      },
    ],
  },
});
