# Yomi — User Journeys

**Status:** canonical. Real behaviour, in the reader's and the operator's words.

These are the source [MVP.md](MVP.md) is derived from. Each journey names the
**outcome**, the states a real user passes through, and the current state — with
"current state" verified against code, never against a document.

Legend: ✅ works · ⚠️ works with a gap · ⛔ does not work · ⬜ not built

---

## Reader

### J-01 Register — ⬜ not built

A reader with no account opens the app, reads freely, and hits a wall only when
they want to keep something.

**Outcome:** an account exists and the reader is signed in.

**States:** form with email + password · email already registered (same message as
success — no enumeration) · password rejected by the policy · a network failure that
preserves what they typed · success → signed in, redirected onward.

**Current:** there is no register route, no `users` insert anywhere in `src/`, and
`passwordHash` has no writer. `grep "insert(users)" src/` returns zero hits. The
page renders `NotYetBuilt` (T-AUTH-012). The `?next=` and a11y design described in
its header is intent, not code. → **F-003**

### J-02 Sign in — ⛔ no UI (API works)

**Outcome:** signed in, and landed where they intended.

**States:** form · wrong email or password (one uniform message, no hint which) ·
disabled account · success → `?next=` target, or the shelf.

**Current:** `POST /api/auth/login` is real and correct — argon2id verify, dummy-hash
timing defence, 403 for a disabled account, `crypto.randomUUID()` token, cookie set.
`/auth/signin` renders `NotYetBuilt`. **The API works; the form does not exist.**
→ **F-004**

### J-03 Search — ⬜ not built (largest MVP gap)

**Outcome:** the reader finds a title by typing what they know — a CJK title, a
romanised alias, a creator, a tag.

**States:** empty query does not search · results ranked best-first · a CJK query of
one or two characters still works (prefix path) · no results is a real empty state,
not an error · load more · the query is in the URL, so the search is shareable and
the back button works.

**Current:** `/search` renders `NotYetBuilt`. `api/search/route.ts:8` throws. The
`searchRaw` port has no implementation. The page header names `GET /api/v1/search`,
which does not exist. **The only landed half is the two GIN trigram indexes.**
Search is anonymous-allowed, which is why it could be built while accounts were not.
→ **F-010, F-011, F-012**

### J-04 Discover — ✅ works

**Outcome:** the reader browses a filterable grid of published titles.

**Current:** real — 22 titles, 8 genres, working filters, no stub.

### J-05 Open manga — ✅ works

**Outcome:** cover, title, aliases, status, chapter count, direction, creators,
genres, tags, synopsis, full chapter list.

**Current:** real, via `GET /api/v1/manga/{slug}` + `/chapters`. No stub.
**Gap:** the Continue-Reading button is dead code — see J-09.

### J-06 Read a chapter — ⚠️ reads, but writes wrong

**Outcome:** real page images, next/previous page.

**Current:** images are real (`/media/{assetKey}.jpeg`, 32 chapter directories on
disk). Next/previous page work and are disabled at the bounds.

**Gap, P0:** progress is saved through `queries/reader-state.ts:248`, a plain
overwrite of `completed`, instead of the repository's sticky-OR. **Every page change
writes `completed: false`, erasing a finished chapter.** That path also never
maintains `library_entry.last_read_at`, so the shelf's default sort stays NULL for
anything read. → **F-006**

### J-07 Navigate chapters — ⬜ not built

**Outcome:** from inside the reader, the reader moves to the previous or next
chapter without going back to the detail page.

**Current:** absent. The chapter list is fetched **only** to resolve the current
chapter's id and is then discarded. The data already exists —
`ChapterRepository.pageList` returns prev/next published neighbours per its own port
doc (`chapters.repository.ts:31`). Nothing surfaces it. → **F-007-S1**

### J-08 Deep-link a page — ⬜ not built

**Outcome:** `?page=N` opens that page; out-of-range clamps to `[1, pageCount]`.

**Current:** absent. No `searchParams` anywhere in the route; state initialises to
1. This also means the bookmark "jump" link in `/bookmarks` — which builds the
contract-correct `?page=N` href — currently lands on page 1. → **F-007-S2**

### J-09 Resume — ⚠️ built, unreachable

**Outcome:** "Continue Ch. 12 · p. 45" on manga detail, for a signed-in reader.

**Current:** the page has full Continue/Start-from/Latest logic, the contract parses
`continueReading` (`catalog-schema.ts:98`), and the page consumes it (`:142`). But
`src/app/api/v1/_runtime.ts:33` `resolveCaller()` returns `null` unconditionally, and
`CatalogService.detail` short-circuits on it. **The button is dead code; every
signed-in reader gets "Read Chapter 1".** A stale comment at
`manga/[slug]/page.tsx:41-44` claims the field "is not in the parsed contract yet" —
false. → **F-009**

### J-10 Progress persists — ⚠️ the silent one

**Outcome:** reopen the chapter, land on the page you left, and "completed" is still
set.

**Current:** the repository is correct — LWW, idempotence, sticky-OR, all in one
transaction, guarded by a conflict-clause `WHERE` so racing tabs cannot both win.
**The reader does not use it.** The defect is J-06. A reader who finishes a chapter
and returns to it sees it marked unread, with no error anywhere. → **F-006**

### J-11 Mark unread — ⬜ not built, and the API lies

**Outcome:** a reader who finished a chapter can mark it unread to re-read it.

**Current:** `library.service.ts:189-200` `setReadStatus(false)` reads the flag and
writes the same value back — a self-documented guaranteed no-op (SQ-LIB-7) — **and
has zero callers repo-wide.** The port exposes only `saveProgress`, `getProgress`,
`mergeProgress`, `getCompletedSet`. There is no unset operation at any layer.

**Decision:** implement it, do not delete the surface. The sticky-OR invariant
protects *progress*; it does not protect against a reader's deliberate intent to
re-read. The fix is a dedicated `unsetCompleted` write, not a flag flip smuggled
through `saveProgress`. → **F-008**

### J-12 Library — ✅ works

**Outcome:** add/remove a title; see unread count and last-read position.

**Current:** real (Batch 2, `7af4e6a`). Unread badge, "Ch. 12 · p. 45", covers from
the DTO, `unavailable` for a title that can no longer be opened, cursor pagination.
**Unreachable:** no account can be created, though a seeded account can sign in.

### J-13 Bookmarks — ✅ works

**Outcome:** add a mark, jump to it, remove it; unopenable chapters are retained.

**Current:** real. The remove is a server action, so the row is gone with scripting
disabled too. **Gap:** the jump href is correct but lands on page 1 (J-08).

### J-14 History — ✅ works

**Outcome:** reading sessions, newest first, deepest page, "still open", load older.

**Current:** real. A deleted chapter is retained as `chapter: null`. The pagination
cursor had a real defect — compared against `::bigint` while `reading_history.id` is
a uuid, so page 1 worked and every "load older" returned 500. **Fixed in Batch 2**
(`7af4e6a`) and pinned by a mutation test.

### J-15 Settings — ⬜ model without an owner

**Outcome:** reader preferences persist and are actually used.

**Current:** `/settings` renders `NotYetBuilt`. **No preferences API exists** — the
header names `src/app/api/v1/preferences/route.ts`, which does not exist. The
`reader_preference` table is real (`schema.ts:539`, live in `0000`), typed at
`shared/contracts/reader.ts:104` — and has no port, no repository, no service, no
route, no reader. `zoomDefault` and `autoNextChapter` are cited in
`docs/product/reader-behavior.md` as though live. → **F-013, F-014**

### J-16 Delete account — ⬜ not built

**Outcome:** remove the account and everything scoped to it.

**Current:** `T-AUTH-011`, unbuilt. Must cascade; `reset_token` too.

---

## Operator

### J-17 Add a manga — ⬜ not built

**Outcome:** the operator creates a title with cover, metadata and publish state.

**Current:** `createAdminService:69` throws `T-ADMIN-001`. `admin.service.ts` declares
`AuditSink`, which has no implementation either. **Service layer may be built now;
no route until F-005 exists** ([SECURITY.md §3](SECURITY.md)). → **F-016**

### J-18 Add chapters and pages — ⬜ not built

**Outcome:** the operator creates chapters, ingests page images, and publishes them.

**Current:** `createUploadPipeline:58` throws `T-UPLOAD-006`;
`prepare-chapter-upload.ts:51` throws `T-UPLOAD-014`; the three upload routes throw.
`image-processor.ts:31` throws `T-UPLOAD-004`.

**Decision:** F-017 replaces the resumable multi-part `upload_job` pipeline with
**single-part ingest**. An operator uploading a chapter needs a working retry, not
resume; the CLI seed already covers bulk. The `upload_job` table stays untouched, so
this is reversible. Same routing constraint as J-17. → **F-017**

### J-19 Page guard — ⛔ not enforced

**Outcome:** `/admin` is unreachable without an admin session.

**Current:** no page has route-level protection
(`middleware.ts:38` `matcher: ['/__t-auth-007-matcher-not-configured__']`). Member
*data* is still protected by per-request checks, so the exposure today is page shell
and layout — P2. **It becomes P0 the moment an admin route exists.** → **F-005**

---

## Journeys not MVP

Resumable multi-part upload (J-20) · admin users/uploads/audit viewers (J-21) · audit
event viewer (J-22) · recommendations, social, offline (J-23). Rationale in
[PRODUCT.md](PRODUCT.md) and [MVP.md](MVP.md).
