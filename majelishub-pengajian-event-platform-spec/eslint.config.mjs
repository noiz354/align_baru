/**
 * ESLint 9 flat config.
 *
 * Five rules are load-bearing because they encode decisions that review alone keeps losing:
 *   majelishub/module-boundaries       T-ARCH-002 · ARCHITECTURE.md §5, ADR-0002 - the dependency
 *                                      direction app -> features -> domain -> shared, plus the
 *                                      client/server and Drizzle-schema boundaries.
 *   majelishub/no-fake-implementation  T-ARCH-003 · AGENTS.md §4.1/§5 - no constant `success: true`
 *                                      returns; every `Not implemented` stub names a real TASKS.md id.
 *   majelishub/no-token-logging        T-SEC-004 · OBSERVABILITY.md §7 - no token/code/contact-named
 *                                      fields in a logging call, and no interpolated message. It reads
 *                                      the same ban list the runtime guard drops against.
 *
 * All three custom rules are unit-tested against fixtures in `tests/unit/lint/**` and
 * `tests/unit/observability/**` using this very config, so a rule that stops working after a dependency
 * upgrade fails a test rather than silently passing.
 *
 * State (2026-09-27): boundaries, no-fake, the token-logging ban and the console ban are delivered.
 */
import tseslint from "typescript-eslint";
import { majelishubPlugin } from "./ops/eslint/index.mjs";

export default tseslint.config(
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "drizzle/**"],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
      },
    },
    plugins: { majelishub: majelishubPlugin },
    rules: {},
  },
  {
    // Architecture: layering is checked where the layers live. Tests are exempt from the layer rule
    // (they legitimately reach into every layer) but not from the no-fake rule.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { majelishub: majelishubPlugin },
    rules: {
      "majelishub/module-boundaries": ["error", { requireReason: true }],
      "majelishub/no-fake-implementation": "error",
      "majelishub/no-token-logging": "error",
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    plugins: { majelishub: majelishubPlugin },
    rules: {
      "majelishub/no-fake-implementation": "error",
      "majelishub/no-token-logging": "error",
    },
  },
  {
    // OBSERVABILITY.md §5: exactly one logging interface. `src/server/bootstrap/**` is where that
    // interface is configured, so it is the only place raw console output is allowed.
    files: ["src/**/*.{ts,tsx}", "tests/**/*.ts", "ops/**/*.mjs"],
    ignores: ["src/server/bootstrap/**"],
    rules: {
      "no-console": "error",
    },
  },
);
