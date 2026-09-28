# F-023 GATE-INTEGRITY — SPEC

## User problem

The gates that report on this project report less than they appear to. Three
specific ways:

1. **`PLANNED_REPOSITORIES` undercounts the gaps by more than half.** It names 4
   ports; 10 have no implementation. The other 6 — four services plus
   `PasswordHasher` and `AuditSink` — are invisible to the only machine-checked
   inventory in the repo. A reader of that list concludes the work remaining is
   four repositories.
2. **Thirteen test files are skipped, and the number reads as coverage.** Vitest
   prints "13 skipped" beside "605 passed", in the same breath. Their assertions
   never execute. All 13 do name what they are waiting on — but by convention, not
   by check, so the convention can rot silently.
3. **A file-existence check cannot see this codebase's gaps.** Most ports with no
   implementation still *have* a file: `search.repository.ts` declares the
   interface, `admin.service.ts` declares the service, and the factory inside
   throws. Anything counting files would report those as done.

## Current implementation

- `PLANNED_REPOSITORIES` (`src/server/db/repositories/index.ts:115`) — 4 entries,
  machine-checked for the "must not exist" direction by `check-claims.mjs`.
- `check-claims.mjs` has two claim classes: `landed-file` (a `✅ landed` doc line
  asserts the file exists) and `planned-file` (a `PLANNED_*` entry asserts it does
  not). Both directions of file drift, nothing else.
- `check-task-status.mjs` derives task state from three signals — a
  `Not implemented: T-…` throw, a `TODO(T-…)`, and a page rendering
  `NotYetBuilt` — and has no notion of a skipped test suite at all.

## Required behaviour

The inventory of what is missing is complete, machine-checked, and cannot go
stale. When a port is implemented, the check **fails** until the inventory is
updated. A skipped suite that names nothing is visible and fails the build.

## Scope

- A new machine-checked inventory of every stub, keyed by the throw rather than
  the file.
- A checker class that verifies it, failing in the drift direction that currently
  has no guard.
- A skipped-suite audit that reports the count and fails on an unnamed skip.
- Exclude documentation directories from the evidence scan.

## Non-goals

- Not deleting the 13 skipped suites. They are legitimate: each waits on a real
  unimplemented port. This slice makes them countable, not absent.
- Not changing any task's computed state as a result of this slice. The numbers
  move only because the scan stops reading `specs/`.
- Not adding a check to CI. The scripts already run there.

## API changes

None. No route, no contract, no error code.

## UI changes

None.

## Persistence / schema changes

None. No migration.

## Authorization

Not applicable.

## Error behaviour

None added. Both scripts report through their existing output and exit codes.

## Edge cases

| Case | Expected |
|---|---|
| A listed stub stops throwing | **CONTRADICTED** — the inventory is stale |
| A listed stub's file is deleted | **CONTRADICTED** — the entry is stale |
| A listed stub throws a *different* task | **CONTRADICTED** — entry and code have drifted apart |
| A new `Not implemented: T-…` appears and is not listed | **Not detected.** Acknowledged gap: the check is inventory-driven, not a diff. The status checker still counts the throw, so the task is not lost — it simply has no stub-inventory entry. |
| A skipped suite names only `INT-…` | Accepted. Both id schemes are real. |
| A skipped suite names nothing | Reported and counted; fails `--strict` |
| A task is named only in `specs/` | Not evidence. Documentation is not the tree. |

That seventh row was found the hard way: adding `specs/` gave T-READER-021 a
`todo` pointing at `CHECKLIST.md` — a file that is nothing but a list of tasks to
do. Reading a promise as a stub inverts the tool.

## Affected files

- `src/architecture/pending-implementations.ts` — new, the inventory
- `scripts/check-task-status.mjs` — skipped-suite audit; evidence-scan exclusions
- `../scripts/check-claims.mjs` — the new claim class

## Dependencies

None. Parallel-safe with F-022 and F-020.

## Acceptance criteria

See [ACCEPTANCE.md](ACCEPTANCE.md).

## Verification

Three planted mutations, all of which must be caught. See
[ACCEPTANCE.md](ACCEPTANCE.md) and [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Rollback concern

Low. Reverting the two scripts and deleting one new file restores the previous
behaviour exactly. The only lasting effect would be the loss of a 23-entry
inventory, which is a document.
