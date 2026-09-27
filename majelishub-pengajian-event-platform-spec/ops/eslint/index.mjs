/**
 * The project's own ESLint plugin.
 *
 * Where this belongs: `ops/eslint`. These rules encode decisions that would otherwise be enforced only
 * by review, which is how they get lost:
 *
 *   majelishub/module-boundaries       T-ARCH-002 · ARCHITECTURE.md §5 · ADR-0002
 *   majelishub/no-fake-implementation  T-ARCH-003 · AGENTS.md §4.1/§5 · DESIGN.md phase rule
 *   majelishub/no-token-logging        T-SEC-004 · OBSERVABILITY.md §7 · ADR-0006
 *
 * Each rule is unit-tested against fixtures in `tests/unit/lint/**` - a rule with no test is a rule
 * nobody can prove still works after a dependency upgrade.
 */
import moduleBoundaries from "./module-boundaries.mjs";
import noFakeImplementation from "./no-fake-implementation.mjs";
import noTokenLogging from "./no-token-logging.mjs";

export const majelishubPlugin = {
  meta: { name: "eslint-plugin-majelishub", version: "1.0.0" },
  rules: {
    "module-boundaries": moduleBoundaries,
    "no-fake-implementation": noFakeImplementation,
    "no-token-logging": noTokenLogging,
  },
};

export default majelishubPlugin;
