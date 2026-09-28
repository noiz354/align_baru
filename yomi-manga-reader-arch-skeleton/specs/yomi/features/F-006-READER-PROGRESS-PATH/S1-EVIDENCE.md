# F-006-S1 — ACCEPTANCE: the reader's progress write path

## A1 — The defect, reproduced before the fix

`tests/integration/reader-progress-path.test.ts`, 5 tests, written first and run
against the unfixed code:

| Test | Before the fix |
|---|---|
| does NOT erase completion when the reader moves to another page | **fails** — `expected false to be true` |
| maintains `library_entry.last_read_at` | **fails** — `expected null not to be null` |
| still refuses anonymous / unknown chapter / out-of-range page | passes |
| records the page actually asked for | passes |
| uses a repository, not a direct write | **fails** |

The two headline failures are the P0 and its consequence, stated as assertions
rather than as a description.

## A2 — After the fix

5 passed. The route now writes through `ReaderProgressRepository.saveProgress`, so
LWW, idempotence, sticky-OR and the `last_read_at` touch all apply.

## A3 — Status codes are unchanged

401 · 404 · 422 · 200 are identical before and after. A rewire that quietly
changed a status code would be a NEW defect, so the negative test asserts the same
numbers it always did — and it passed both times.

The one behaviour corrected was in the test, not the route: it assumed a page past
the end gets clamped. The route REFUSES it with a 422, which the negative test
already covered. The clamp I assumed does not exist and should not; the test now
sends a page inside the range and asserts the stored value.

## A4 — Mutation

| Injected | Result |
|---|---|
| route reverted to `upsertProgress` (the original overwrite) | **3 tests fail** |

A first attempt at that mutation changed `completed` to read from the body while
still writing through the repository, and **passed** — because the repository's
sticky-OR made the second write harmless. It could not have detected the real
defect, which lived in the *write path*, not in the argument. The working mutation
restores the old path wholesale.

## A5 — The architecture bypass is closed

- [x] the route no longer imports `createDb`/`closeDb`
- [x] it no longer imports `server/db/queries/reader-state.ts`
- [x] it reaches `readerProgress` through the `/api` seam, like every other
      members' route
- [x] `readerProgress` is exposed by `createLibraryComposition` as the SAME
      instance the library service receives, so "one writer" is one object

## A6 — Known not yet done

- [ ] `queries/reader-state.ts` still exists and still serves the auth routes
      (`insertSession`, `deleteSessionByToken`) and the chapter-pages route →
      **F-006-S2**. This slice stops the bleeding; it does not delete the file.
- [ ] the reader client still has no `.catch` on its save, so a failure is silent
- [ ] `completed` still cannot be unset → F-008-S1

## A7 — Gates

- [x] 615 → **620 passed (620)**, 0 failed
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass · prettier clean
- [x] `next build` compiles

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-006-S1 |
| Tests | 3 of 5 failing before, 5 of 5 passing after |
| Mutation | 3 failures |
| Files | the progress route, `api/_deps.ts`, `api/_runtime.ts`, `composition.ts`, the new test |
| Commands | the mutation · full regression gates |
| Notes | The test needed `process.env.DATABASE_URL` pointed at its throwaway database, because the route built its own handle from the environment — the bypass itself. After this slice the route takes an injected handle, so that shim is no longer load-bearing. |
