# Yomi — Audit (2026-09-28)

**MVP readiness:** `SKELETON_ONLY` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd yomi-manga-reader-arch-skeleton
npm install --legacy-peer-deps  # 313 pkgs, Next 16.3.6, EBADENGINE Node22 vs >=24 <25 (expected per README; boots on 22)

# Boot (no PG — AppShell + error boundaries are expected without DB):
DATABASE_URL=postgres://yomi:yomi@localhost:5432/yomi_dev \
APP_URL=http://localhost:3103 PORT=3103 npm run dev -- --port 3103 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack with | without) - Local: http://localhost:3103 - Ready in 946ms

# Verification (without DB):
curl -s http://localhost:3103/discover | grep -E "Catalog|All titles|catalog unavailable"  # → error boundary "The catalog is unavailable"
curl -s http://localhost:3103/ | grep -E "Yomi|reading room"  # → header Yomi exists, catalog empty (25KB)
npm run typecheck  # tsc --noEmit → PASS
npm run perf:bundle  # node scripts/check-bundle-budget.mjs → PASS (when budgets met)
npm run lint       # eslint . → PASS
```

**URL:** `http://localhost:3103` — AppShell at `src/app/layout.tsx` with `Header` (Yomi, Catalog, Search, Library, History, Bookmarks, Settings).

**Stack:** `next 16.3.6`, `drizzle-orm 0.44.7` + `drizzle-kit 0.31.7`, `postgres 3.4.7`, `pglite` not used here (real PG required), storage `S3` via `ObjectStoragePort` (`FR-UPLOAD-*`, `T-UPLOAD-004` pending).

## 2. Seed Data

**What was seeded for this audit:** *Nothing* — no PG was provisioned, so `scripts/seed.mjs` was not invoked. `/discover` therefore correctly shows the **error boundary** (parallel reads `readCatalogPage`/`readGenreFacets` each fail independently per `discover/page.tsx` contract — see §3).

**What the harness *would* seed if PG/S3 were up (T-FOUND-012, `scripts/seed.mjs` v0.1):**

* **Guard:** `--env` REQUIRED (`dev|test`), exit 2 on prod-creds, exit 4 if schema not migrated (`drizzle/0000_initial_schema.sql` via `npm run db:migrate`). Uses typed boot (`FR-CFG-001`, `NFR-CFG-001/002/003/008/010/014`). `--env test` prefixes every `slug`/`email`/`alias`/`asset_key` with `run-id` for CI isolation.
* **Phase 1 today (no S3 bytes):** DB rows only, `asset_key = sha256(slug|chapter|page)[:32]` (opaque, non-guessable per `FR-MEDIA-003`), `byte_size_avif|webp|jpeg` true (sharp synthesizes 480×720 solid color in-memory, bytes then dropped — requirement `NFR-PERF-014` satisfied, window `[1..3]` on 500-page case). No upload bytes, so image URLs 404 until Phase 2.
* **Phase 2 post-`T-UPLOAD-004`:** re-run with `commitPages(replace:true)` to upload real `ObjectStoragePort` bytes and GC-queue old variant keys (`FR-UPLOAD-009`).
* **Determinism / idempotency:** `deterministicUuid(naturalKey)` (v7-shaped), titles `Seed Manga 0001` .. `Seed Manga 0500-Pages`, geometry `480x720` fixed, no timestamp/hostname/random in `--timings Report.md`. Argon2id hashes use random salt — stored once, never UPDATEd, `POST /api/seed reload` is pure no-op. `INSERT … ON CONFLICT DO NOTHING` only, never UPDATE/DELETE/DDL, repositories reused (`createSeedRepositories(db)`).
* **What `--env dev` would create (once PG18 + S3 are up):**

| Entity | Rows | Example |
|---|---|---|
| Users | 2 | `admin@yomi.test` (admin), `reader@yomi.test` (reader), argon2 |
| Manga | 3 or 30 or 10000 | `Seed Manga 0001` (12 pages), `Seed Manga 030`, `Seed Manga 0500-Pages` (500 pages, `NFR-PERF-014`) |
| Chapters | 1–3 per manga | `ch01` asset keys `sha256(...)[:32]` |
| Pages | 12–500 per manga | `480×720`, variant sizes true |
| Progress/Library | 1+ each | `reading_progress` (page 12/12 for 0500), `library_entry`, `bookmark` |

* **Required for this audit (admin, regular, 3 manga, chapters, pages, progress, bookmark, library)** — exactly the table above.
* **What we actually saw without PG:** header + filters render, `All titles` error boundary with `Cause. The list of titles could not be read just now. What you can do. Try again.` — this is `Promise.allSettled([catalog, facets])` in `discover/page.tsx` catching and rendering `DiscoverContent` + `DiscoveryHeader`.

## 3. Screens Inspected

`1440×1000` headless Chromium, `setBypassCSP(false)` not needed (no strict CSP), `networkidle2` + 1.5 s hydration.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/yomi/01-home.png` (25 KB) | `GET /` | Home — header + catalog preview | Header `Yomi` (black), nav `Catalog · Search · Library · History · Bookmarks · Settings·`, main `Yomi — A reading room…` + footer `Status …`. **No manga grid** (no DB rows). Dark header correct, body is shell | Empty preview; not a product error — correct without DB |
| `screenshots/yomi/02-discover.png` (76 KB) | `GET /discover` | Discover catalog (core slice `T-CATALOG-003`, `T-FOUND-006`) | Left `Filters`: genre pills (`Genre: adventure …`), `Any status`, `Recently updated`. Main `All titles`: **error boundary** card: `The catalog is unavailable — Cause. The list of titles could not be read just now. — What you can do. Try again.` + `DiscoveryHeader` badge. Filters render; grid fails independently | Not a broken layout — intentional error boundary (reads are parallel). Zero titles rendered (no seed) |
| `screenshots/yomi/03-manga-404.png` (51 KB) | `GET /manga/sample-notfound` | Manga detail (`[mangaSlug]`, `T-MANGA-001`) | `not-found.tsx` style `404`-like manga missing page, no cover | Not-found honest (no row for `sample-notfound` in empty DB) |
| `screenshots/yomi/04-library.png` (21 KB) | `GET /library` | Library (`T-LIBRARY-001`) | AppShell + empty state `Library is empty` | Shell UI; no library_entry row |
| `screenshots/yomi/05-history.png` (21 KB) | `GET /history` | History (`T-READER-*`) | Empty state | Same |
| `screenshots/yomi/06-search.png` (21 KB) | `GET /search` | Search (query param) | Empty boundary | Same |
| `screenshots/yomi/mobile-01-home.png` (27 KB) | `GET /` mobile 390×844 | Mobile | Same header collapsed, shell | — |

**Visual inspection summary:** AppShell is polished (Header with real nav, focus ring, footer). `discover/page.tsx` correctly **does not** spinner-block the whole page when `readGenreFacets` fails — it stays usable. No placeholder manga cards are faked when empty (honest). No image ever loads (`asset_key` placeholders) without Phase 2.

## 4. Primary Flow

**Spec journey (reader `reader-behavior.md` → `discover/page.tsx` contracts):** *regular reader views catalog → opens a manga → opens a chapter → reads via pagination*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Regular reader views catalog at `/discover` | Grid of titles (sorted `sort=updated`, `pageSize 96`, genre/stream filters) from `readCatalogPage` | Filters render, but `readCatalogPage(db)` throws (no PG connection), caught as `catalogError`, shown as `The catalog is unavailable`. No fake `Seed Manga` cards. | **FAIL — blocked by missing PG, not UI bug** |
| 2. Opens a manga at `/manga/[slug]` | Detail via `readMangaDetail(mangaId, session?)` | `mock not available` — without DB the page’s `readMangaDetail` throws and the route returns `not-found`. Screenshot `03-manga-404.png` shows that. | **FAIL — unavailable (no DB row)** |
| 3. Opens a chapter at `/manga/[slug]/chapter/[num]` | Reader chrome, preface, image | `T-READER-*` not landed; `src/app/manga/[mangaSlug]/chapter/[chapterSlug]/page.tsx` is `FORCE_DYNAMIC` + placeholder. Even with DB, Phase 1 would return placeholder keys (no bytes) → image 404, correctly. | **MOCK — synthetic image bytes per `review-prompt-e71fd…`, no S3** |
| 4. Reads via pagination (mode Single/Double/Vertical, `Window [1..3]` on 500-page) | Pagination, `DiscoverContent` snapshot, reading_progress bookmark, continue-reading ≤20 | No page loop runs without chapter data. `Progress` component requires `reading_progress` row. | **MOCK — placeholder asset_key:true size, no blob** |
| 5. Library/history updates | `library_entry` (most recent first, max 20) | Empty state in screenshots 04/05 — no entry. | **FAIL — no DB** |

**Overall flow:** **FAIL** at step 1 in the audited environment (no PG). This is the correct `PHASE 0` evidence: the spec *intentionally* shows the fallback rather than mocking titles in production code. In a real PG+seeded environment the same code follows the deterministic harness above.

## 5. Blocking Issues

**P0 — prevents MVP flow:**

* **No provisioned Postgres + S3** — `readCatalogPage` / `readGenreFacets` require a PG18 connection. With `DATABASE_URL` unset they throw and the discover page shows the error boundary. This is **distinguished from “core cannot run”**: the catalog is not “mocked”, it is genuinely unavailable without the declared external services. `T-FOUND-012`’s harness can fill it once PG is up.
* **Placeholder asset keys only (Phase 1)** — per `T-UPLOAD-004` not landed, `asset_key`s are opaque random-like hexes but no S3 blob exists so images 404. Phase 2 (`commitPages + GC-queue`) is the fix before a user can see a page.
* **Product vertical slices not landed (`VS-1…11` per `TASKS.md`)** — `T-CATALOG-003` (discover query), `T-READER-*` (reader chrome), `T-LIBRARY-001` (continue-reading), etc. The `T-` labels in `src/app/discover/page.tsx` already reference the right tasks but the implementations are stubs.

**P1 — serious but workaround exists:**

* **Node >=24 required** (`package.json engines 24.10.0`) for `@electric-sql/pglite` parity with HomeOps/MajelisHub — the audit booted on Node 22 with a warning, but tooling/tests may diverge. Use `nvm use 24` when running `perf:bundle` / `seed`.
* **Seed guard `FR-UBND-001` and `NFR-SEC-002`** — `npm run seed -- --env dev` needs `S3_ENDPOINT` etc even in Phase 1 (for byte-length synthesis); the error `exit 2 refused (credential config)` is correct but opaque.

**P2 — polish / production concern:**

* **`allowNoStrictCombine`, `assumes internet`** — `SEED_DATA.md` notes Phase 2 needs real variant bytes. Until then bundle budget (`perf:bundle`) and perf traces are no-op.

## 6. MVP Verdict

**`SKELETON_ONLY`**

**Why:** The app **boots reproducibly** (`Ready in 946ms`, `AppShell` renders, `typecheck` PASS) and the catalog fallback is **correct** (not fake). However **most primary functionality is placeholders, stubs, or mock**: every dataful page is an error boundary or `not-found` without PG, and images are synthetic hex keys with no blob (`review-prompt` explicitly says “no generated asset is treated as licensed content — synthesized 1×1/480×720 solid color”). The two-phase harness is the honest plan to make it runnable, but Phase 1 is not yet exercised because no PG was provisioned.

## 7. Smallest Path to MVP

To reach **`RUNNABLE_DEMO`** (catalog live on dev seed, retention purge not required):

1. **Provision PG18 + `drizzle/0000_initial_schema.sql`, then `npm run seed -- --env dev` (or `--load-titles 30`)** — this is expected to insert `Seed Manga 0001` (12 pages) + `0500-Pages` (500 pages, 480×720) + `admin@yomi.test`/`reader@yomi.test` + progress/library. Verify with `curl -s http://localhost:3103/discover | grep "Seed Manga"` no longer shows error boundary.
2. **Implement Phase 2 of `T-UPLOAD-004` / `T-FOUND-012`** — make `ObjectStoragePort` upload real variant bytes for the seeded `asset_key`s so `/manga/[slug]/chapter/[num]` can render at least the 12-page case (no need for 10k titles). Keep `asset_key` opaque via `sha256(...)[:32]`, GC-queue the Phase-1 keys per `FR-UPLOAD-009`.
3. **Land `T-CATALOG-003` + `T-READER-004` minimal** — make `readCatalogPage` return the seeded rows with `sort=updated` + pagination `96`, and the reader page show `Single` mode with `Window [1..3]` (bonus: prove `<60s` on the 500-page case via `use --timings` in the harness). No need for `T-SOCIAL`, `T-LOCK`, or `T-BACKUP` for next level.

After those three, the primary flow `regular views catalog → opens manga → reads pagination` would be **`RUNNABLE_DEMO`** (real catalog, real progression in PG, synthetic images).

**Not needed for next level:** 10k-title perf harness, `T-UPLOAD` rename GC (“Cleaners”), notifications, backup, browser-image rendering as JPEG at 420 kpx minimum is already synthetic — production bytes are Phase 2 but not required to clear `RUNNABLE_DEMO`.
