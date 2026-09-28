# Yomi — MVP Definition

**Status:** canonical. This file answers exactly one question: *what must exist for
a real person to actually use Yomi?*

It is derived from [USER_JOURNEYS.md](USER_JOURNEYS.md), not from `TASKS.md`. A task
exists to get to this; a task that does not serve a journey here is not MVP work.

**This file is not a status report.** It states what must be true. For what *is*
true, read [execution/CHECKLIST.md](execution/CHECKLIST.md).

## Current baseline

605 tests, 605 passing, 0 failing. HEAD `7af4e6a`. (`8ebc15f~1` is not a useful
comparison: it predates the media seed and is red for unrelated reasons.)

## The MVP in one paragraph

A reader registers, signs in, searches for a title, opens it, reads every chapter
with real page images, navigates chapter to chapter, closes the tab, and comes back
to the same page with "completed" still set. They have a shelf, bookmarks, and a
history. An operator can add a title, its chapters and their page images, and
publish them. Nothing on that path may 500, and nothing on it may lose the reader's
record.

## MVP journeys

Each row is a *user-visible outcome*. "Not a stub" is not an outcome.

| # | Journey | Outcome the user observes | MVP? |
|---|---|---|---|
| J-01 | Register | Creates an account, is signed in afterwards | ✅ |
| J-02 | Sign in | Signs in, lands where they intended (`?next=`) | ✅ |
| J-03 | Search | Finds a title by CJK or romanised alias, from the shelf page | ✅ |
| J-04 | Discover | Browses a filterable grid of published titles | ✅ |
| J-05 | Open manga | Sees cover, metadata, creators, genres, synopsis, chapter list | ✅ |
| J-06 | Read a chapter | Real page images, next/previous page | ✅ |
| J-07 | Navigate chapters | Previous/next chapter from inside the reader | ✅ |
| J-08 | Deep-link a page | `?page=N` opens that page, clamped to the chapter | ✅ |
| J-09 | Resume | "Continue Ch. 12 · p. 45" on manga detail, and on returning to the app | ✅ |
| J-10 | Progress persists | Reopening the chapter restores the page; **completion is never erased** | ✅ |
| J-11 | Mark unread | Can re-read a chapter they finished | ✅ |
| J-12 | Library | Add/remove a title; see unread count and last read position | ✅ |
| J-13 | Bookmarks | Add a mark, jump to it, remove it | ✅ |
| J-14 | History | Reading sessions, newest first, load older, unopenable chapters retained | ✅ |
| J-15 | Settings | Reader preferences persist and are actually used by the reader | ✅ |
| J-16 | Delete account | Removes the account and everything scoped to it | ✅ |
| J-17 | Add a manga | Operator creates a title with cover, metadata, publish state | ✅ |
| J-18 | Add chapters | Operator creates chapters and ingests page images, then publishes | ✅ |
| J-19 | Page guard | `/admin` is unreachable without an admin session | ✅ |

### Explicitly NOT MVP

| Journey | Why not |
|---|---|
| J-20 Resumable multi-part upload | An operator uploading 200 pages needs retry, not resume. F-017 ships single-part ingest; the CLI seed remains the bulk path. Reversible. |
| J-21 Admin users / uploads / audit viewers | Useful after the catalogue is real, not before. F-018 post-MVP. |
| J-22 Audit event viewer | Same. F-019 post-MVP, unless compliance is a hard requirement — in which case it moves into Wave 5. |
| J-23 Read recommendations, social, offline | Not the product. See [PRODUCT.md](PRODUCT.md). |

## MVP is not reached until

All of the following are true **and evidenced** in the checklist:

1. **J-01…J-19** are each demonstrable in a browser by someone who did not write
   the code, against a real database and real object storage.
2. **Zero unexplained test failures**, and **zero silently skipped suites** — a
   skipped test is a hole, not a pass.
3. **One runtime connection.** Two pools per request is a capacity and correctness
   problem, not a style choice (F-001).
4. **One session authority.** Three disagreeing implementations of session
   storage is three different answers to "is this user signed in" (F-002).
5. **Zero `NotYetBuilt` pages in the reader journey** (`/`, `/discover`, `/search`,
   `/manga/*`, `/library`, `/bookmarks`, `/history`, `/settings`).
6. **No write path bypasses the repository that owns the invariant.** If
   `queries/reader-state.ts` still exists, this is not met (F-006).
7. **E2E runs in CI** (F-021), so the journeys cannot silently rot.

## The two defects that make "MVP complete" a lie today

Both are recorded here rather than only in the checklist, because both are silent.
Neither raises an error; both lose data.

**1. Reading erases completion.** The reader's save route calls
`queries/reader-state.ts:248`, which writes `completed: progress.completed` — a
plain overwrite. The client sends only `{pageNumber}`, and the route passes
`completed: Boolean(body.completed)`, so **every page change writes
`completed: false`**. The documented invariant (`progress.repository.ts:547`) is a
sticky OR. A reader who finishes a chapter and then reads it again has it silently
marked unread, with no error anywhere. Fixed by F-006.

**2. There is no way to create an account.** `grep "insert(users)" src/` returns
zero hits; there is no register route; `passwordHash` has no writer. Signing in
works — the seed creates real accounts — so this is invisible in development and
total in production. Every member-facing feature is complete and unreachable.
Fixed by F-003.

## Definition of done for a journey

Per [execution/VERIFICATION_MATRIX.md](execution/VERIFICATION_MATRIX.md), a journey
counts as MVP-complete only when all six cells are non-empty:

| Unit | Integration | Runtime/API | Browser | Negative | Isolation |
|---|---|---|---|---|---|

Not "the page renders". Not "the test passes". Not "the file exists".
