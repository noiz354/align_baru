/**
 * PHASE 0 shell. Vitest 4 with Browser Mode (Playwright provider) is the selected runner
 * (docs/research/STACK-2026.md §2.14, TESTING.md). Every suite in tests/ is TODO-only.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    coverage: { provider: "v8", reporter: ["text", "html"] }
  }
});
