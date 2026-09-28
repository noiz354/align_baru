# F-023-GATE-INTEGRITY — IMPLEMENTATION

## 1. The inventory — `src/architecture/pending-implementations.ts`

Entries are `{ file, task }`, one per `(file, throw)` pair. A file throwing for two
tasks has two entries.

Paths are relative to the inventory file's own directory. It sits in `src/`, so
every path is one `../` up — `../features/auth/session.ts`, `../app/api/search/route.ts`.

**The first attempt used repo-root-relative paths and all 23 entries failed** with
"the file named as a stub does not exist", because this is a monorepo and the
checker's `REPO_ROOT` is the monorepo root, not the Yomi project. Resolving against
the claiming file's directory — as the two existing claim classes already do —
fixed it and made the paths readable.

## 2. The claim class — `scripts/check-claims.mjs`

New `collectStubClaims()`, reusing the existing verdict pipeline:

```
file missing              → CONTRADICTED
file present, no throw    → CONTRADICTED  "no longer throws — implemented but still listed"
file throws a different id→ CONTRADICTED  "no longer throws the task it is listed under"
file throws that exact id  → CONSISTENT
```

Backwards compatible: bare-name `PLANNED_*` lists still resolve as
`<name>.repository.ts`, so no other project changes behaviour. Only Yomi uses
`PLANNED_*` at all.

## 3. The skipped-suite audit — `scripts/check-task-status.mjs`

`auditSkippedSuites()` walks `tests/unit` and `tests/integration`, flags files with
a top-level `describe.todo`/`describe.skip`, collects their ids, and prints:

```
13 test file(s) are skipped: assertions that never run. 0 of them name no task id.
```

Unnamed files are listed and make `--strict` exit non-zero.

**Pattern correction:** the first version matched only `T-…` and reported
`tests/integration/search.test.ts` as unnamed. It was not — it names
`INT-SEARCH-001`, a TEST_STRATEGY planned-test id. The real scheme is
`T- | INT- | UNIT- | E2E-`. The checker was wrong about the convention it enforces,
and a stricter checker would have created work for no reason.

## 4. The evidence exclusion

`specs`, `MVP_AUDIT` and `docs` added to `SKIP_DIRECTORIES`.

Adding the `specs/` tree gave T-READER-021 a `todo` evidence path of
`specs/yomi/execution/CHECKLIST.md`. A plan is a promise, not a stub. `TASKS.md`
stays in scope — it is the inventory the report is computed *from*.

## 5. Mutations

| # | Mutation | Expected | Observed |
|---|---|---|---|
| 1 | delete the `T-OBS-001` throw from `src/server/telemetry/otel.ts` | CONTRADICTED | ✅ 60 consistent / 1 contradicted |
| 2 | delete `src/app/api/search/route.ts` | CONTRADICTED | ✅ |
| 3 | plant `describe.todo` with no id | 1 unnamed, listed | ✅ |
| 4 | plant `// TODO(T-FOUND-001)` on an ABSENT task | ABSENT 81→80, STUB 36→37 | ✅ |

**Three earlier attempts at these mutations were wrong and were corrected**, which
is why they are worth recording:

- Mutation 1 v1 replaced `throw new Error('Not implemented: T-OBS-001');` — but the
  real line ends `(telemetry init)`, so the replace was a **no-op** and the checker
  correctly reported 61 consistent. The mutation had not happened.
- Mutation 4 v1 planted `TODO(T-READER-021)`, which is **already STUB**, so the
  counts could not move. Planting a TODO on a task that is already blocked proves
  nothing. The mutation now targets a task picked from the `ABSENT` bucket.
- All of them were caught by printing the counts, not by trusting the assertion.

## 6. Files

| File | Change |
|---|---|
| `src/architecture/pending-implementations.ts` | new — 23 entries, typed |
| `scripts/check-task-status.mjs` | `auditSkippedSuites()` + summary line + `--strict` + skip dirs |
| `../scripts/check-claims.mjs` | `collectStubClaims()` wired into the verdict pipeline |

## 7. Risk

Shared code: `check-claims.mjs` serves 8 projects. The change is additive — a new
collector and a spread into the existing array. Bare-name `PLANNED_*` behaviour is
untouched, and no other project declares one, so the blast radius is Yomi only.

## 8. Order of work

1. Enumerate every `Not implemented: T-…` in `src/` with its file — do not guess
2. Split into the two classes: no-file (repository) vs exists-and-throws (stub)
3. Add `collectStubClaims()`; wire it in
4. Write the inventory; iterate until 61/61 consistent
5. Add `auditSkippedSuites()`; correct the id pattern against a real file
6. Exclude `specs`/`MVP_AUDIT`/`docs` from the evidence scan
7. Run all four mutations, **printing the counts each time**
8. Full regression gates
9. Commit as `F-023-S1`
