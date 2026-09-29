# F-016-S1+S2 — ACCEPTANCE: `AdminService` manga and chapter CRUD

S1 and S2 in one commit: the manga and chapter operations share the ports, the
audit discipline and the admin gate — splitting them would manufacture a seam in
the work where there is none in the code.

## A1 — What shipped

`createAdminService` no longer throws. Manga list/create/update/publish, chapter
list/create/update/publish/reorder, all service-layer-only: no route, no page,
no form, and the diff is the proof (no new files under `src/app`).

- [x] manga list (everything, newest first), create (slug derived or given,
  links in one transaction), update (scalars + wholesale link replacement),
  publish/unpublish as a transition (a no-op audits nothing)
- [x] chapter list, create (appended at end of order), update, bulk publish
  with `{affected, skipped}`, reorder from the full ordered id list
- [x] publish is a state transition: first publish stamps `published_at`,
  unpublish keeps the stamp, re-publish keeps the original — "unpublished" and
  "never published" stay distinguishable
- [x] unknown ids are the §6 codes, checked before the write — never an FK 500
- [x] a non-admin caller fails with 403 before any read, so a probe learns
  nothing, not even existence
- [x] every mutation appends exactly one audit event before returning, with
  small summaries and never a synopsis or notes body (EC-ADM-06)

## A2 — Three structural decisions

**Separate admin ports, not methods on the read ports.** `MangaRepository` and
`ChapterRepository` are read ports with dozens of fakes across the suite, and
admin reads are unscoped while every read-port method scopes by caller. One
interface cannot honestly promise both. `AdminMangaRepository` and
`AdminChapterRepository` live in `features/admin` and are implemented beside the
others.

**The service checks the role itself.** The skeleton says the web guard owns the
re-check and the service assumes admin. Until the routes land, the service IS
the only layer — a service that assumed admin without checking would let a
reader curate the catalogue the moment anyone called it. `AUTH_FORBIDDEN` for a
non-admin, first line of every method. When the web guard arrives the check
becomes redundant, which is what defence in depth means.

**Deletes, covers, users, stats and the viewer stay throwing.** The acceptance
names list/create/update/publish(+reorder) and nothing else. Soft-delete with
restore is its own state machine, cover ingest rides the upload pipeline, user
management is T-ADMIN-006, the viewer is F-019. Each keeps its task-ID throw —
visible, named, and out of this slice on purpose rather than forgotten.

## A3 — Two things the work corrected

**A block comment containing `*/` closes itself.** The test file's header named
a path with a glob (`app/**/admin*`), and the `**/` inside a `/* */` comment
ends the comment early — turning the backtick before it into a template opener
and everything after into template text. Three parse errors from one glob.
Reworded; recorded because it reads as a toolchain failure and is a keystroke.

**Slug immutability for manga has no stamp to consult.** EC-ADM-07 says the
slug is immutable after first publish; the manga row carries no
first-published stamp (that would be a migration, and this slice needs none),
so "currently published" is the rule: a published title keeps its slug, a draft
may still be renamed. Stated in the service header so the limitation is visible
rather than structural.

## A4 — Mutations

| Injected | Result |
|---|---|
| the admin check removed | 1 test fails |
| the ≥1-page publish gate removed | 1 test fails |
| unpublish overwrites the stamp | 1 test fails |
| the published-slug guard removed | 1 test fails |
| reorder in one phase (unique collision) | 1 test fails |
| the publish audit renamed (wrong action) | 1 test fails |

## A5 — Gates

- [x] 747 → **766 passed (766)** (19 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles
- [x] `PLANNED_STUB_PORTS` lost the factory entry after `check-claims.mjs`
  failed the build on it — the fourth inventory catch in this track

## A6 — What is NOT claimed

- Routes, pages, forms, or any way to reach this from a browser. Service layer
  only, until F-005.
- The audit viewer (F-019). What is asserted is that the events are EMITTED.
- Deletes, covers, users, stats. Throwing, named, out of scope.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-016-S1+S2 |
| Files | `features/admin/admin-ports.ts` + `admin.service.ts`, `server/db/repositories/admin.repository.ts`, 1 test, `PLANNED_STUB_PORTS` trimmed |
| Tests | +19 |
| Mutations | 6 of 6 caught |
| Commands | 6 mutations · full regression gates · `next build` |
| Notes | Curation exists and is unreachable: the operations are real, tested and audited, and no route can call them yet — which is the safe direction for the deferral to fail in. |
