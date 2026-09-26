#!/usr/bin/env node
/**
 * scripts/verify-docs.mjs
 *
 * Documentation and skeleton-honesty gate. Created in VS-0 (T-PLAT-008); this is a
 * placeholder shell — it performs NO checks until that task is implemented.
 *
 * Planned checks (all of them fail the build when violated):
 *  1. Required root documents exist (list mirrored from CONTRIBUTING.md / AGENTS.md §6).
 *  2. Required docs/ sub-documents exist and have > 20 lines of content.
 *  3. No empty placeholder files anywhere in docs/ (files with only a heading).
 *  4. Every ADR contains the full fixed section set (Status, Date, Context, Problem,
 *     Decision Drivers, Options Considered, Decision, Consequences, Positive, Negative,
 *     Risks, Mitigations, Revisit Conditions, References).
 *  5. Task-ID integrity: every `T-XXX-NNN` referenced in docs, `src/`, or `tests/` exists
 *     in TASKS.md; every task in TASKS.md is referenced at least once outside TASKS.md.
 *  6. Skeleton honesty: every file under src/ that exports a function with a
 *     `Not implemented: T-...` doc comment must throw (a body returning a value is a
 *     violation), and no skeleton may contain `return true`, `return []`,
 *     `return { status:` or `return Promise.resolve(` as a stub.
 *  7. No secret-looking literal in a committed file; `.env.example` contains keys only.
 *  8. TRACEABILITY.md covers every P0/P1 requirement id from PRD.md.
 *
 * Exit code 0 = pass, 1 = violations found (printed with file:line).
 */
throw new Error('Not implemented: T-PLAT-008');
