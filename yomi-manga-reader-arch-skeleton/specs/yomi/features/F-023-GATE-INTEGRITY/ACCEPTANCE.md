# F-023 GATE-INTEGRITY — ACCEPTANCE

## A1 — The inventory covers all ten unimplemented ports

- [x] every `throw new Error('Not implemented: T-…')` reachable in `src/` has an
      inventory entry — 23 entries across 15 files
- [x] the four services (`SearchService`, `AuthService`, `AdminService`,
      `UploadPipeline`) plus `PasswordHasher` and `AuditSink` are represented
- [x] `PLANNED_REPOSITORIES` still covers the 4 repository implementations that
      have no file, which is a different and still-correct check
- [x] `check-claims.mjs` settles all 61 file-landmark claims: **61 consistent, 0
      contradicted**, exit 0

## A2 — The inventory cannot go stale

- [x] removing the throw from a listed stub → `CONTRADICTED`, detail
      "it no longer throws — the port is implemented but still listed as pending"
- [x] deleting a listed stub's file → `CONTRADICTED`
- [x] a listed stub throwing a *different* task id → `CONTRADICTED`

## A3 — Skipped suites are counted, and an unnamed one fails

- [x] the summary line reports `13 test file(s) are skipped`
- [x] all 13 name what they wait on, via a `T-` task id **or** an `INT-`/`UNIT-`
      planned test id — `0 of them name no task id`
- [x] planting `describe.todo('…')` with no id → `1 of them name no task id`, the
      file is named, and `--strict` exits non-zero

## A4 — Documentation is not evidence

- [x] `specs`, `MVP_AUDIT` and `docs` are excluded from the evidence scan
- [x] no task's reported evidence path begins with those directories
- [x] T-READER-021's evidence is `src/features/progress/reader-progress.repository.ts`,
      not `specs/yomi/execution/CHECKLIST.md`
- [x] `TASKS.md` deliberately remains in scope

## A5 — The TODO rule still holds

- [x] planting `// TODO(T-FOUND-001)` on an `ABSENT` task moves it
      ABSENT 81 → 80 and STUB 36 → 37
- [x] removing the planted TODO restores 81 / 36

## A6 — Task state is otherwise unchanged

- [x] `137 tasks: BLOCKED 20 · STUB 36 · PLACEHOLDER 0 · ABSENT 81` — identical to
      the pre-slice figure. The exclusion corrects *evidence*, not *state*.
- [x] `12 page(s) render NotYetBuilt` — unchanged

## A7 — Regression gates

- [x] `npx tsc --noEmit` → 0
- [x] `npx eslint .` → clean
- [x] `node scripts/check-boundaries.mjs` → 7 rules + control
- [x] `node ../scripts/check-claims.mjs` → exit 0
- [x] `npx vitest run` → **605 passed (605)**
- [x] `node scripts/check-task-status.mjs` → exit 0

**Known pre-existing, not fixed here:** `../scripts/check-claims.mjs` fails
`prettier --check`. It already did at `HEAD~1`, and it sits at the monorepo root
outside the Yomi project's prettier gate. Formatting it would add unrelated churn
to a shared file; recorded rather than silently absorbed.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-023-S1 (this commit) |
| Claims checked | 38 → **61**; contradicted 0 |
| Tasks | 137, unchanged: BLOCKED 20 · STUB 36 · ABSENT 81 |
| Skipped suites surfaced | 0 → **13** |
| Tests | 605 passed, 0 failed |
| Commands | `node ../scripts/check-claims.mjs [--json]` · `node scripts/check-task-status.mjs [--json\|--strict]` · the three mutations · full regression gates |
| Notes | Three of the first attempts at the mutations **failed to mutate anything** and one asserted a state that could not change. Both were caught by observing the counts rather than the assertion. See IMPLEMENTATION.md. |
