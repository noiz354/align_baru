/**
 * The project's own ESLint plugin.
 *
 * Where this belongs: `ops/eslint`. These rules encode decisions that would otherwise be enforced only
 * by review, which is how they get lost:
 *
 *   majelishub/module-boundaries       T-ARCH-002 · ARCHITECTURE.md §5 · ADR-0002
 *   majelishub/no-fake-implementation  T-ARCH-003 · AGENTS.md §4.1/§5 · DESIGN.md phase rule
 *
 * Each rule is unit-tested against fixtures in `tests/unit/lint/**` - a rule with no test is a rule
 * nobody can prove still works after a dependency upgrade.
 */
import moduleBoundaries from "./module-boundaries.mjs";
import noFakeImplementation from "./no-fake-implementation.mjs";

export const majelishubPlugin = {
  meta: { name: "eslint-plugin-majelishub", version: "1.0.0" },
  rules: {
    "module-boundaries": moduleBoundaries,
    "no-fake-implementation": noFakeImplementation,
  },
};

export default majelishubPlugin;
