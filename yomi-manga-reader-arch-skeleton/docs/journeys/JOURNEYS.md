---
doc_id: yomi.journeys
title: 'Yomi — user journeys, with screenshots'
counterpart: ../../USER_GUIDE.md
implementation_status: current
document_status: stable
translation_status: source-only
last_verified: 2026-09-29
---

# Yomi — user journeys, with screenshots

> **Core question:** what does Yomi actually do today, step by step, in a
> real browser — and where does it break? **Audience:** anyone evaluating the
> current build. **Depth:** orientation with evidence, not implementation.
> **Status:** **Current** — every claim below was observed on the build at
> `083caaf` against the dev seed described in “Environment notes”.

Every journey below was walked in a real browser (Playwright Chromium,
desktop 1440×900 unless noted) against a seeded local server. Each step is a
screenshot plus the story of what the user did and what the app said back.
Nothing here is a mock: the accounts, titles, chapters, and progress rows are
real database rows, and the sign-in, shelf, and progress writes went through
the real routes.

Reproduce: start the dev server on `localhost:3199` (the host matters — see
“Environment notes”) and walk the steps with any scriptable Chromium; the
captures here used a throwaway Playwright script (not committed) that saved
each full-page screenshot plus `steps.json`.

**Read first:** two defects distort several screenshots. Both are **Current**
(status: verified in the running build, not inferred).
They are real, reported — the screenshots below show the app _as it is_,
including the broken parts:

- **D-IMG-001 (P0): the reader can never show a page image.** The pages API
  hands the client `/media/{key}` with no extension, but the delivery route
  only accepts `/media/{key}.avif|webp|jpeg` (the extension is the variant
  selector, taken from the key, never from the request). Every reader `<img>`
  is a 404 with a designed-for error state. One-line symptom:
  `/media/61701…93159` → 404, `/media/61701…93159.avif` → 200.
- **D-IMG-002 (P0): no cover ever renders.** The seed writes
  `cover_asset_key = seed/v1/cover/<hash>`; the same grammar rejects slashes,
  and the route parameter is a single path segment anyway. All 22 catalog
  titles show “NO COVER”.

## J1 · An anonymous reader discovers something to read

The story: a first-time visitor lands on Yomi with no account and no history.
There is no dashboard — the home page is honest about that — so the journey
starts from the one door that is open: the catalog.

1. `01-discovery/01-home.png` — **Lands on the home page.** “This page is not
   built yet”, with the task that owns it (T-CATALOG-003) and a working
   “Browse the catalog” link. A placeholder that says so is a promise, not a
   dead end.
2. `01-discovery/02-catalog.png` — **Clicks “Browse the catalog”.** 22 real
   titles with statuses and chapter counts, genre chips (up to 5, Escape
   clears), a status filter, and sort. Every title is a link.
3. `01-discovery/03-discovery-filters-by-genre-fantasy.png` — **Filters by
   genre Fantasy.** The chip latches pressed and the list narrows; the control
   responding at all proves the page hydrated.
4. `01-discovery/04-discovery-opens-a-title.png` — **Opens “Seed Manga 0001”.**
   Aliases, status, chapter count, direction, creators, genres, tags,
   synopsis, “Read Chapter 1” / “Latest: Chapter 2”, and a chapter table. The
   cover slot is empty (D-IMG-002).
5. `01-discovery/05-discovery-sorts-and-filters-by-status.png` — **Filters by
   status Completed.** Only finished titles remain; the filter composes with
   the sort.

## J2 · Reading a chapter

The story: from the title page the reader starts chapter 1 and turns pages.
The chrome all works — counter, prev/next, thumbnails, next-chapter link,
progress persistence. The pictures do not (D-IMG-001), and the reader refuses
to pretend: it names the exact page and offers a retry.

1. `02-reading/01-reading-picks-chapter-1-to-read.png` — **Picks Chapter 1.**
   Back on the title page, choosing where to start.
2. `02-reading/02-reading-reader-opens-on-page-1.png` — **Reader opens on
   page 1.** “Seed Manga 0001 · Right to left · 8 pages”, Page 1/8, thumbnails
   1–8, “Next chapter (2) →”, a debug strip. The image slot shows the
   designed-for failure: “Page 1 of 8 is in the chapter, but its image is not
   in storage.”
3. `02-reading/03-reading-taps-next-page.png` — **Taps “Next page”.**
   Advances to Page 2/8 and records progress (verified server-side).
4. `02-reading/04-reading-jumps-to-the-last-page.png` — **Jumps to page 8.**
   On the last page the primary action becomes the next chapter
   (auto-next preference), not a dead Next button.

## J3 · Deep links and clamping

The story: a link from outside — a friend’s message, a bookmark, a note —
lands mid-chapter. The `?page=` parameter wins over saved progress, and
nonsense values clamp instead of blanking.

1. `03-deep-link/01-deep-link-opens-page-4-directly.png` — **`?page=4`.**
   Opens on page 4 even though saved progress says otherwise.
2. `03-deep-link/02-deep-link-opens-page-999.png` — **`?page=999`.** Clamps
   to the last page; no 404, no empty reader.
3. `03-deep-link/03-deep-link-opens-page-0.png` — **`?page=0`.** Clamps up to
   page 1.

## J4 · Searching

The story: the reader knows what they want and goes to Search. The query
lives in the URL, so a search is a link you can share. Typing debounces;
nonsense gets an empty state, not an error page.

1. `04-search/01-search-opens-search-with-an-empty-box.png` — **Empty box.**
   Anonymous and reachable, as the contract requires.
2. `04-search/02-search-types-resume.png` — **Types “resume”.** 10 prefix
   matches, each labelled with kind, band (“prefix match”), and which field
   matched (“matched on title”).
3. `04-search/03-search-types-nonsense.png` — **Types nonsense.** An empty
   state that says what to do next.
4. `04-search/04-search-reopens-a-shared-search-link.png` — **Reopens
   `/search?q=seed`.** The same results, from the link alone.

## J5 · The signed-in shelf

The story: a reader with an account. Anonymous Library first (signed-out
state, not a crash), then sign-in, and the shelf comes alive: the kept title,
its unread count, the last position, history, and — the proof of the whole
resume seam — the title page button reading “Continue Chapter 1 — page 3”.

1. `05-member-shelf/01-member-shelf-anonymous-opens-library.png` —
   **Anonymous opens Library.** Signed-out state with a way forward.
2. _(no shot)_ — **Signs in as the seeded reader.** `POST /api/auth/login`
   → 200; the session cookie carries the rest of the journey.
3. `05-member-shelf/02-member-shelf-signed-in-library.png` — **Signed-in
   Library.** One title on the shelf: “2 UNREAD”, “Ch. 1 · p. 3”, read and
   added dates.
4. `05-member-shelf/03-member-shelf-history.png` — **History.** What was
   read, and how far.
5. `05-member-shelf/04-member-shelf-bookmarks.png` — **Bookmarks.** Saved
   titles.
6. `05-member-shelf/05-member-shelf-continue-reading.png` — **Returns to the
   title.** The button is “Continue Chapter 1 — page 3”, resolved from the
   signed session through the real caller seam — the moment the whole track
   was building toward.

## J6 · What a user meets that is not built yet

The story: the curious (or lost) user clicks everything. Nothing crashes;
every unbuilt surface says it is unbuilt, names the task that owns it, and
offers a way back to reading.

1. `06-honesty/01-honesty-visits-auth-signin.png` — **`/auth/signin`.**
   NotYetBuilt; real sign-in is the deferred F-004.
2. `06-honesty/02-honesty-visits-settings.png` — **`/settings`.**
   NotYetBuilt; the preferences table already has an owner (F-013), the page
   does not.
3. `06-honesty/03-honesty-visits-admin.png` — **`/admin`.** NotYetBuilt; the
   admin service exists but no route may expose it before F-005 guards.
4. `06-honesty/04-honesty-visits-does-not-exist.png` —
   **`/does-not-exist`.** A real 404, with a way home.

## J7 · The reader on a phone

The story: the same reader, on a Pixel 7. The narrow layout is a first-class
gate (the 320px floor), not an afterthought.

1. `07-mobile/01-mobile-reads-on-a-phone.png` — **Reads on a phone.**
   Counter, prev/next, thumbnails, and next-chapter link all fit; the image
   failure state fits too (D-IMG-001).
2. `07-mobile/02-mobile-browses-the-catalog-on-a-phone.png` — **Catalog on a
   phone.** Same 22 titles, narrow grid.

## Environment notes (read before reproducing)

- **Use `localhost`, never `127.0.0.1`, for the browser.** Next 16 refuses the
  dev HMR WebSocket upgrade from `127.0.0.1` with a bare `Unauthorized`
  (verified at the socket level), and a dev client that never completes that
  handshake never hydrates: every page renders server HTML, React attaches no
  fibers, and no click works. Verified three ways — DevTools Chrome,
  Playwright Chromium, and DOM fiber probes — on both a poisoned and a clean
  `.next` cache: `aria-pressed` stays `false` on `127.0.0.1`, flips `true` on
  `localhost`. (Secondary symptom, only with a production build sitting in
  `.next`: client asset chunks also 403 for the IP host. A clean cache
  restores 200s, but hydration still never starts — the socket refusal is the
  load-bearing cause.) The E2E harness proxies through `127.0.0.1`, so local
  dev E2E interactivity is dead by construction; CI uses `next start`, which
  has no such check, and is unaffected.
- **Match storage between seed and server.** The seed writes page objects to
  the filesystem when `STORAGE_DIR` is set; the server reads S3 unless
  `STORAGE_DIR` is set. Mismatched, every image is a storage-level miss.
  Also note the env schema demands S3 credentials even in filesystem mode —
  both must be present.
- The DB used here was re-seeded (`seed.mjs --env dev --manga 10
--load-titles 200`, then the 200 chapter-less perf fixtures removed so page
  1 of the catalog is readable). The `resume-*` fixtures and their progress
  rows were kept. Seeded accounts: `seed-admin@seed.invalid`,
  `seed-reader@seed.invalid` (passwords from `SEED_ADMIN_PASSWORD` /
  `SEED_READER_PASSWORD`).

## New findings from this pass (for the ledger)

1. **P0 — images can never load (D-IMG-001/D-IMG-002).** Documented above
   (**Current**). The contradiction is between ADR-005 / `API_CONTRACT.md` §2.1
   (Accept negotiation) and `src/server/media/page-delivery.ts`
   (extension-in-key, deliberately non-negotiating).
2. **Local dev E2E interactivity is dead by construction.** `playwright.config.ts`
   defaults to `E2E_BASE_URL=http://127.0.0.1:…`, and the harness proxies
   through that same host — where the dev server never hydrates (see above).
   Any passing interactive assertion in that posture passed against server
   HTML. The suite should use `localhost` or set `allowedDevOrigins`. CI runs
   `next start` and is unaffected.
3. **Fixture fragility.** The catalog-perf “Cover 404s” test needs a seeded
   title this box lacked; the genre-chip tests assumed the 200 perf fixtures.
   Both are environment-coupled in the same way F-021’s evidence already
   records.
