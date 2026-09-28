# F-020 DOC-ARCHIVE — SPEC

## User problem

`MVP_AUDIT/` at the monorepo root carried ten status matrices whose Yomi rows
assert progress that did not exist. Three of them are titled in a way that invites
belief — `_FINAL`, `_WAVE3`, `READINESS_PROGRESS` — and one of them was cited by
the master gap audit as evidence. A reader arriving at this repository has no way
to tell which document to believe, and the most confidently-titled one is the
least accurate.

## Current implementation

Ten markdown files at `MVP_AUDIT/`, none annotated, covering eight projects.
Yomi appears as one row per table:

- `MVP_MATRIX_FINAL.md` — "3 RUNNABLE_DEMO (yomi, …)"
- `MVP_MATRIX_WAVE3.md` — Yomi `MVP_PARTIAL`, "Authenticated user-owned library,
  bookmarks, and progress"
- `WAVE3_REGRESSION.md` — progress "survive logout/login and application restart"
- `SEED_DATA.md` — **plaintext seed passwords**
- `RUNTIME_COMMANDS.md` — "boots without [PostgreSQL]", contradicting SEED_DATA's
  documented verifying seed

Three screenshot scripts, of which only `screenshot-yomi.mjs` is Yomi's;
`screenshot.mjs` captures HomeOps (`/chores`) and `screenshot2.mjs` captures the
parking app (`/queue`).

## Required behaviour

Exactly one file states execution status, and it is the project checklist. Every
superseded claim is annotated with the specific thing that is wrong about it.
Nothing is deleted. Another project's audit material is labelled, never moved.

## Scope

- Move the ten superseded Yomi-relevant matrices to `MVP_AUDIT/archive/`.
- Annotate each in place, naming the false claim specifically.
- Replace `MVP_AUDIT/README.md` with a pointer to the canonical checklist.
- Correct the record about the screenshot scripts.

## Non-goals

- Not touching `projects/`, `progress/`, `wave3/` or `screenshots/` — real evidence.
- Not archiving `screenshot.mjs` / `screenshot2.mjs`. They belong to HomeOps and
  the parking app. The monorepo rule is that a task touches one project folder;
  tidying Yomi's status must not restructure another project's tooling.
- Not rewriting the archived documents. They are history, and history that has
  been edited is not history.
- Not deleting the plaintext passwords from git history — only from the live
  annotation, since they no longer work and must not be reproduced.

## API / UI / persistence / schema changes

None.

## Authorization

Not applicable.

## Error behaviour

None.

## Edge cases

| Case | Handling |
|---|---|
| A file covers several projects | Archived whole, annotated as cross-project; its non-Yomi rows are not judged |
| An archived file is the last record of something | Kept in full in `archive/` — annotation is prepended, body untouched |
| A future project lands and wants its own matrix | It goes in that project's folder, not here |
| Someone greps for `MVP_READY` | Hits only the new README, which quotes the term while saying it is false |

## Affected files

- `MVP_AUDIT/README.md` — rewritten
- `MVP_AUDIT/archive/*.md` — 10 files moved and annotated
- `yomi-manga-reader-arch-skeleton/specs/yomi/features/F-020-DOC-ARCHIVE/*`

## Dependencies

None. Parallel-safe with F-022 and F-023.

## Acceptance criteria

See [ACCEPTANCE.md](ACCEPTANCE.md).

## Rollback concern

None. `git mv` and a prepended annotation; reverting restores the exact previous
tree.
