# F-006-S2 — ACCEPTANCE: `queries/reader-state.ts` is deleted

## A1 — The file is gone, and nothing references it

- [x] `src/server/db/queries/reader-state.ts` (252 lines) deleted; the `queries/`
      directory is now empty and removed
- [x] **no importer remains** in `src/` or `tests/`
- [x] its three production callers were rewired: the progress route (F-006-S1), the
      two auth routes, and the chapter-pages route
- [x] `PLANNED_REPOSITORIES` lost `'session'`, and `check-claims.mjs` FAILED the
      build on the stale entry before I fixed it — the inventory guard working in
      the direction it exists for

## A2 — Where its work went

| Was | Now |
|---|---|
| `insertSession`, `deleteSessionByToken`, `findUserByEmail`, `touchLastLogin` | `server/db/repositories/session.repository.ts` |
| `findChapterById`, `findMangaById`, `listChapterPages` | `ChapterRepository.pageList` behind the `/api/v1` seam |
| `findProgress`, `upsertProgress` | `ReaderProgressRepository` (F-006-S1) |
| `listLibraryEntries`, `insertLibraryEntry`, `deleteLibraryEntry`, `listBookmarks`, `insertBookmark` | `LibraryRepository` / `BookmarkRepository` (Batch 2) — the helpers were already unreachable |

The session adapter is deliberately the MINIMUM the login and logout routes need.
The `SessionRepository` PORT declares six methods with sliding-idle expiry and its
own implementation still throws `T-AUTH-006`. Implementing that is F-002, on the
deferred auth track — so this slice deletes the bypassing file WITHOUT dragging the
session model in, which would have produced a fourth disagreeing implementation
instead of two. The adapter's header says so, and `findLiveSessionByToken`
documents that it does not slide `expiresAt`.

## A3 — No coverage lost

`tests/integration/library.test.ts` (11 tests) tested the deleted helpers. Seven
asserted on columns and scoping of code that no longer exists and whose behaviour
`members-surface.test.ts` already covers against the SHIPPING implementations.
Four were real and were **ported**, not dropped, to
`tests/integration/reader-progress-repository.test.ts`:

- null before the first write (no phantom resume position)
- round-trips position, scroll and the completion flag
- one row per (user, chapter) on re-read
- does not read another reader's progress for the same chapter (THREAT T-04)

## A4 — The chapter-pages route had NO tests, and I rewrote it

That is the risk this slice carried, and the test found something: the port returns
`/media/{key}` with **no file extension**, while the old hand-built route appended
`.jpeg` / `.avif`. My first assertion expected the extension.

The port is right and the old route was wrong: `/media/{key}` negotiates the stored
format from the `Accept` header (ADR-005, API_CONTRACT §2.1), so all three variant
URLs are the same path. The route this replaced had **lost** that negotiation. The
test now asserts the extension is absent and that all three URLs are identical.

Two real behaviour changes, both recorded rather than glossed:

- **409 → 404** for an unpublished chapter. The old answer confirmed to an
  anonymous caller that a draft exists. All three cases (missing, unpublished
  manga, unpublished chapter) now answer `CHAPTER_NOT_FOUND` identically. A client
  branching on 409 would notice, and that is the correct trade.
- **The response grew `prevChapter` / `nextChapter`** — already in the contract
  (FR-READER-016) and already returned by the port; the old route dropped them.
  Additive, and it is where F-007-S1 gets its navigation data.

The test asserts `mangaId` is **absent** — the old response carried it, the contract
does not, and the reader client never read it. Asserted so the claim cannot rot.

## A5 — Mutations

| Injected | Result |
|---|---|
| route returns 404 regardless of the port | **3 of 4 tests fail** |
| port stops returning `prevChapter`/`nextChapter` | **1 test fails** |

## A6 — Gates

- [x] 620 → **618 passed (618)** — 11 deleted, 9 added
- [x] tsc 0 · eslint clean · boundaries 7/7 + control · claims pass
- [x] `next build` compiles
- [x] task counts unchanged at BLOCKED 20 · STUB 36 · ABSENT 81; 13 skipped suites

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-006-S2 |
| Deleted | `src/server/db/queries/reader-state.ts` (252 lines), `tests/integration/library.test.ts` (11 tests) |
| Added | `session.repository.ts`, `reader-progress-repository.test.ts` (5), `chapter-pages-route.test.ts` (4) |
| Tests | 620 → 618, with 4 behaviours ported and 9 new |
| Commands | the two mutations · full regression gates · `next build` |
| Notes | Both new seams (`ApiDeps.readerProgress`, `ApiV1Deps.chapters`) required no stubs: the compositions already had the objects, so `chapters` and `readerProgress` are real handles, not optional fields. |
