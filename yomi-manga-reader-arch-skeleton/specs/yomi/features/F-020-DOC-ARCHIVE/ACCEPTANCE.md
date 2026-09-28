# F-020 DOC-ARCHIVE — ACCEPTANCE

## A1 — One status source

- [x] `MVP_AUDIT/README.md` states that the only status source is
      `yomi-manga-reader-arch-skeleton/specs/yomi/execution/CHECKLIST.md`
- [x] no file at `MVP_AUDIT/` root asserts a completion state; the only match for
      `MVP_READY|MVP_PARTIAL|RUNNABLE_DEMO` is the new README, which quotes those
      terms while saying they are false

## A2 — Nothing deleted, everything annotated

- [x] all 10 matrices present in `archive/` — `git status` shows `D` + `??`, i.e.
      renames, not removals
- [x] each carries a prepended `ARCHIVED 2026-09-28 (F-020-S1)` block pointing at
      the checklist
- [x] the original body is unmodified after the annotation
- [x] each annotation names the **specific** false claim, not "outdated"

Verified individually for: `MVP_MATRIX_FINAL` (nothing about `7af4e6a` is
compatible with "FINAL"), `MVP_MATRIX_WAVE3` (isolation true, authentication
impossible), `SEED_DATA` (documents passwords the seed now refuses),
`WAVE3_REGRESSION` (isolation proven, logout/login unobservable),
`RUNTIME_COMMANDS` (contradicts `SEED_DATA` in the same archive),
`WAVE2_BASELINE` (recorded nothing), `WAVE3_BASELINE` (grade defined against
nothing), `MVP_MATRIX_AFTER`, `MVP_MATRIX`, `READINESS_PROGRESS`.

## A3 — Another project's material is labelled, not moved

- [x] `MVP_AUDIT/projects/`, `progress/`, `wave3/`, `screenshots/` untouched
- [x] `screenshot.mjs` (HomeOps) and `screenshot2.mjs` (parking) left in place,
      identified in the README by the routes they capture
- [x] `screenshot-yomi.mjs` kept as the one working script

## A4 — A second record corrected

- [x] the master gap audit's claim of "10 screenshot scripts" is corrected to
      three, of which one is Yomi's

## A5 — No product behaviour changed

- [x] the diff touches no file under `yomi-manga-reader-arch-skeleton/src/`
- [x] 605 tests still pass; tsc, eslint, boundaries, claims all green

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-020-S1 (this commit) |
| Files moved | 10 → `MVP_AUDIT/archive/` |
| Files deleted | 0 |
| Product files changed | 0 |
| Tests | 605 passed / 0 failed |
| Commands | `git status --porcelain` · `grep -rlE "MVP_READY\|MVP_PARTIAL\|RUNNABLE_DEMO" MVP_AUDIT/*.md` · full regression gates |
| Notes | The archived files span 8 projects. Only their Yomi rows were judged; the rest are another project's record and were left as found. |
