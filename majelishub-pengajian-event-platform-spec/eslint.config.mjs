/**
 * ESLint flat config - PHASE 0 SKELETON.
 *
 * Two architectural rules are load-bearing and must exist as real rules before the first slice:
 *   T-ARCH-002  module boundaries: app -> features -> domain -> shared/server (never reversed)
 *   T-ARCH-003  no fake implementations: constant `success: true` returns and stubs whose
 *               `Not implemented: <task>` id does not exist in TASKS.md are errors
 * Plus: console.* is banned outside bootstrap (T-OBS-002) and token/code-named log fields are banned
 * (T-SEC-004). The ban list is shared with the runtime logger guard - one source of truth.
 *
 * Why this file contains no rules yet: adding rules requires the parser/toolchain installation, which
 * belongs to the first slice (VS-1) per the Phase 0 dependency rule. The rule set, its fixtures and its
 * tests are specified in TASKS.md T-ARCH-002/003 and tests/unit/lint/*.
 */
export default [
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // TODO(T-ARCH-002): boundary rule (no-restricted-imports by layer)
      // TODO(T-ARCH-003): no-fake-implementation custom rule
      // TODO(T-OBS-002): no-console outside src/server/bootstrap/**
      // TODO(T-SEC-004): no logging of token/code field names
    },
  },
];
