/**
 * Documentation consistency gate (T-DOCS-001) - PHASE 0 SKELETON.
 *
 * Runs in CI and locally; fails a pull request when the authoritative documentation becomes
 * self-contradictory. Checks:
 *   1. every file in docs/adr/ appears in ADR.md
 *   2. every requirement ID referenced anywhere is defined in PRD.md
 *   3. every cited docs/** path exists
 *   4. every referenced task ID is defined in TASKS.md
 *   5. no document is empty (headings present)
 *   6. this gate's own logic is unit-tested (tests/unit/docs/references.test.ts)
 *
 * Read-only by design: it never rewrites documents. A finding is fixed in the offending document.
 * Why it matters: the documentation is the contract for future coding agents; silent drift makes every
 * later task wrong (AGENTS.md §1).
 */
console.error("Not implemented: T-DOCS-001 - the docs lint gate is a Phase 0 skeleton");
process.exit(1);
