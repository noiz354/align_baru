# ADR-003 — Documentation is a claim until a command settles it

**Status:** Accepted · **Date:** 2026-09-28

## Context

In this repository, as of `8ebc15f`:

- `majelishub/README.md` documents a gate (`npm run verify:vs0`) that does not exist in
  `package.json`, and asserts `npm run lint` exits 0 when it exits 1 with 8 errors.
- `siomayops/README.md` declares "no working product" across 37 working API routes, and its
  `SECURITY.md` reassures the reader that no authentication code exists — when authentication-shaped
  code grants everything.
- `homeops/README.md` says "implementation has not started" beside 32 working pages, and its
  `SECURITY.md` states "no unscoped query helper exists" beside four routes that take the tenant from a
  query parameter.
- `strangerlink` ships two READMEs asserting opposite things, and the one called `README.md` denies
  the product exists.
- `parking`'s audit evidence describes a `server.py` that appears in no commit of any branch.
- Four documents give four different test counts for `rsi`; three give three for `parking`.

The pattern is not carelessness in any one file. It is that **no document is checked against the tree**,
and a green-looking gate is cited before anyone runs it.

## Decision

1. A status claim is a claim until a command settles it. The command goes in the document.
2. No document states a test count that was not produced by a run. `TEST_EXECUTION.md` is regenerated,
   never hand-edited; other documents link to it rather than repeating the number.
3. A gate that is not executed must not be documented as a gate. Either wire it or delete the claim.
4. `scripts/check-claims.mjs` is extended to check status and test-count claims, not only package
   presence and file landmarks. It currently passes while three P0s sit in `main`.
5. `COMPLETION_MATRIX.md` is archived. It answers "unknown" while occupying the position of an answer.
6. Each audit-evidence file carries `commit / command / expected / reproducible: yes|no`. Evidence
   referring to code that cannot be reconstructed is marked `NON_REPRODUCIBLE` and may not support a
   completion claim.

## Consequences

- `HARNESS.md` and `scripts/check-claims.mjs` are extended rather than retired — they are the right
  instruments, pointed at the wrong claims.
- The seven projects' status documents are rewritten once, from this audit, and then only when a
  command's output changes.
- A follow-up agent can trust `specs/` without re-deriving anything, which is the entire point of this
  pass.

## Alternatives rejected

- **"Just write better docs."** Rejected: the defect is that nothing verifies docs, not that the prose
  is weak. `harness-portable-gate` and `gate-honesty` skills exist in `.opencode/skills/`; the failure
  was that they were never wired into CI as checks.
- **Delete the audit evidence.** Rejected: most of it is genuinely good work, and history is worth
  keeping if it is labelled honestly.
