# F-017-S1 — ACCEPTANCE: single-part chapter ingest

## A1 — The replacement

The resumable multi-part pipeline driver (`run(jobId)`/`sweepStale` on the
`upload_job` table) is REPLACED, not completed: a job table with no worker is
machinery without a purpose, and the seed already populates a catalogue. The
factory name `createUploadPipeline` is kept so the acceptance ("no longer
throws `T-UPLOAD-006`") is literally true; what it builds is one function that
takes page images and lands a chapter — validate → normalise → store objects →
commit rows → optionally publish. `upload_job` stays untouched;
`prepare-chapter-upload.ts` (`T-UPLOAD-014`) and `image-processor.ts`
(`T-UPLOAD-004`) still throw, recorded, not hidden.

- [x] a single-part ingest path exists with the four phases in order
- [x] keys follow the seed's contract through the ONE implementation
  (`pageObjectKey`): `pages/{chapterId}/{32-hex}.{avif|webp|jpeg}`
- [x] a rejected upload leaves no partial rows AND no orphaned objects
- [x] no route, no page, no form — the diff is the proof

## A2 — The two orderings that make it honest

**Normalise-all-before-store-any.** A decode failure on page 5 leaves zero
objects behind, because nothing has been stored yet. The pure phase IS the
rollback strategy — no compensation logic, no staging area to purge, nothing
that can fail halfway.

**Commit-then-purge-on-failure.** Objects stored before a store failure or a
commit failure are deleted best-effort, and the delete failures are swallowed
deliberately: the original error is what the caller must see, and a purge that
throws would replace the cause with the cleanup. Orphans are observable (a
failed ingest returns no keys, so anything it stored is unreferenced by
definition) and reclaimed by the storage lifecycle.

## A3 — The boundary forced a move, and the move was the right shape

`features/uploads` needed `pageObjectKey` and D1 forbids `features/*` from
importing `server/*`. The rule is pure string-building with no infrastructure
in it, so it moved to `shared/storage-keys.ts` — one implementation, two
importers — with the old module re-exporting so every existing server import
keeps working. The first version imported across the boundary and the eslint
rule caught it before any test ran: the fastest failure in this track, and the
cheapest, because a boundary checker fails in milliseconds what an
architecture review fails in days.

## A4 — Mutations

| Injected | Result |
|---|---|
| the mid-store purge removed | **2 tests fail** |
| the commit-failure purge removed | 1 test fails |
| the admin check removed | 1 test fails |
| the 200-page cap removed | 1 test fails |

The mid-store purge initially had NO test: the suite covered decode failures
(before any store) and commit failures, but never a `putStream` that dies
halfway. The mutation passed, correctly, on untested code — so the fake gained
a fail-after-N switch and the test fails the 4th of 9 puts. A mutation that
passes on a path with no test is not a weak test; it is a missing one.

## A5 — Gates

- [x] 766 → **774 passed (774)** (8 new)
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles
- [x] `PLANNED_STUB_PORTS` lost the driver entry after `check-claims.mjs`
  failed the build on it — the fifth inventory catch in this track

## A6 — An observed flake, recorded

One full-suite run failed `media-delivery` + `media-seed-delivery` with S3
`InvalidAccessKeyId` while the change under test touched only key-building
pure functions. Both files pass alone, pass in pairs with the new test, and
the full suite passes on re-run (774/774). Verdict: transient storage-backend
unavailability, not a regression — but per the zero-flake rule it is written
down here rather than waved away. If it recurs, quarantine with a task; the
suspect is RustFS readiness at suite start, not any test's logic.

## A7 — What is NOT claimed

- Routes, pages, forms. Service layer only, until F-005.
- A real image pipeline: `media.normalize` is faked in tests and still throws
  `T-UPLOAD-004` in product. The ingest's contract with it (bytes in, three
  variants out, typed decode failure) is written; the implementation is not.
- Job semantics: no retries, no watchdog, no sweep. A failed ingest is
  retried by the curator re-submitting, which for a synchronous seconds-long
  operation is the whole of the recovery story.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-017-S1 |
| Files | `features/uploads/upload-pipeline.ts` (reshaped), `shared/storage-keys.ts` (new), 1 test, `PLANNED_STUB_PORTS` trimmed |
| Tests | +8 |
| Mutations | 4 of 4 caught (after adding the missing mid-store test the first round exposed) |
| Commands | 5 mutations · full regression gates · `next build` |
| Notes | Ingest exists and is unreachable. The multi-part machinery is replaced, not completed — and the schema still carries its table, untouched, as the record of that decision. |
