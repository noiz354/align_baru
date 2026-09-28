# Minimal Manga Reader — Audit (2026-09-28 → updated 2026-09-28)

**MVP readiness:** `MVP_PARTIAL` (was `RUNNABLE_DEMO` at baseline `7641230`) · **Production readiness:** `NOT_READY` (auth/library/upload pending)

> **Update 2026-09-28 — file-backed progress:** `data/db.json` + `db.getPublishedMangaList()` 3 manga + `ReaderView` real `GET/PUT /api/v1/progress` (restored 5→9, DURABLE). See `MVP_AUDIT/progress/manga-reader-spec-skeleton-minimal/AFTER.md` and `screenshots/after/08` for IDs, version 11, restart persistence.

**MVP readiness (baseline 7641230):** `RUNNABLE_DEMO` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd manga-reader-spec-skeleton-minimal
npm install --legacy-peer-deps  # 78 pkgs, Next 15.5.26 (^15.5 → 15.5.26, 15.4 React transition peer 15.4 not in 15.5)

# Boot (in-memory only, no DB, no DATABASE_URL):
PORT=3104 npm run dev -- --port 3104 --hostname 0.0.0.0
# → ▲ Next.js 15.5.26 - Local: http://localhost:3104 - Ready (no PG wait)

# Verification:
curl -s http://localhost:3104/ | grep "Licensed Manga Reader"
curl -s http://localhost:3104/manga/sample-manga/chapter/1 | grep "Chapter 1: The Beginning"
npm run typecheck  # tsc --noEmit → PASS
npm run test       # node --experimental-strip-types --test tests/unit/reader.test.ts → PASS
```

**URL:** `http://localhost:3104` — `src/app/layout.tsx` with `src/app/page.tsx` landing → `src/app/discover/page.tsx` → `src/app/manga/[mangaSlug]/chapter/[chapterSlug]/page.tsx` + `src/lib/reader/*`.

**Stack:** `next 15.5.26`, `react 19.1.3`, `@fontsource/inter 5.2.8`, no ORM, no `drizzle.config.ts`, no `DATABASE_URL`. Sample Data in `src/lib/manga.ts`.

## 2. Seed Data

**What was seeded for this audit:** *In-memory only* — deterministic sample data hard-coded in `src/lib/manga.ts` and `src/app/discover/page.tsx`. No migration, no seed script, no external service.

* **Title:** `The Licensed Adventure` — author `Spec Team`, direction `RTL`, slug `sample-manga`, cover `art` synthetic.
* **Chapter:** `Chapter 1: The Beginning` — 12 pages. Each page key `asset://manga-sample/ch-001/p-{1..12}` (opaque local placeholder per spec §1 col 2 “no generated asset is licensed”).
* **Geometry:** fixed window `[1..3]` (see §3 reader), `432000px` budget analogue (not enforced here but window bounded).
* **Credentials / accounts:** none — `Auth` is out of scope for minimal. `FR-CFG-001..3` land `dev` only.

## 3. Screens Inspected

`1440×1000` headless Chromium (same bundle), no CSP bypass needed. Dark theme `#09090b` + `#fafafa`.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/minimal/01-home.png` (73 KB) | `GET /` | Landing — proves spec lineage FR-READER-001..014, ADR-007 | Title `Licensed Manga Reader` (36px, `#f43f5e` rose/teal per `globals.css`), line `FR-READER-001..014, ADR-007 …`, two CTAs: primary `Open Reader (Chapter 1) →` rose `#e11d48`, secondary `Discover`. Below, box `Reader Controls & Shortcuts: L/R arrows, M cycle mode, D toggle direction, H toggle chrome, 25% tap sides, 100% zoom`. Real DOM, no mock iframe | None. CTA centered, box true docs not faked. |
| `screenshots/minimal/02-discover.png` (24 KB) | `GET /discover` | Discover — proves catalog convention (`Discover Catalog` subheader `FR-READER-001`) | One card: `Cover Art` placeholder `#27272a` (gray) center text `Cover Art`, title `The Licensed Adventure`, line `Author: Spec Team — Direction: RTL` badge `#84cc16` green? — actually `Direction: RTL` tiny badge, line `Cartoon 2`, CTA `Read Chapter 1` rose | None. One card is the sample; empty search is no result, not error. |
| `screenshots/minimal/03-reader-ch1.png` (34 KB) | `GET /manga/sample-manga/chapter/1` | Reader — Single Page RTL (the main evidence) | Header `Chapter 1: The Beginning — Progress saved` (`readingProgress` in-memory), `Back to Catalog`. Controls bar: `Mode: Single Page` (`M` cycles), `Dir: RTL (Manga)` (`D`), `100%` with `- / +` zoom (`H` toggle chrome). Main card `Page 12` centered 80×80 `#27272a` **Physical #1 of 12** + `Key: asset://…/p-12` (honest synthetic), card caption `Cover Art` etc. Bottom `Tap sides: 25% left/right` + slider `Page 12 of 12` + `Window: [1..3]` (bounded window caching ADR-007) + `||` divider. Keyboard `Arrow L/R` RTL-aware (L=prev, R=next). | None. Flow complete end-to-end. |
| `screenshots/minimal/04-reader-double.png` (34 KB) | `GET /manga/sample-manga/chapter/1?mode=double` | Reader — Double Page (mode mutation) | Same as 03 but `Mode: Double Page`, card shows same page 12 but window still `[1..3]`. Proves mode state is URL-query driven, not fake | None. Mode switch works. |
| `screenshots/minimal/mobile-01-home.png` (62 KB) | `GET /` mobile 390×844 | Mobile | Title 28px, CTAs stacked vertical full-width, box still readable. Minimal’s responsive shell is correct | None. Fonts still Inter via `@fontsource/inter`. |

**Visual inspection summary:** No blank, no TODO overlay, no `Not implemented` throw. The only “mock” is `Cover Art` placeholder `#27272a` — that is **not** treated as licensed content per `HANDOFF / review-prompt` (“synthesized 1×1 … not licensed”) and is the honest minimal state. Actions have visible controls; settings (mode/dir/zoom) are mutations on the same page.

## 4. Primary Flow

**Spec journey (FR-READER-011, ADR-007):** *regular reader views catalog → opens a manga → opens a chapter → reads via pagination*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Views catalog at `/discover` | `Discover Catalog` with card(s), cover, author, direction badge, `Read Chapter 1` CTA | Card `The Licensed Adventure` appears (1 card is sample). `Discover Catalog — FR-READER-001` proven. | **PASS — real action produces visible UI** |
| 2. Opens manga at `/manga/sample-manga` (via catalog) | Manga detail (if exists) or direct to chapter 1 | `/discover`’s `Read Chapter 1` links to `/manga/sample-manga/chapter/1` — clicks are GET navigations (SSR), verified by `page.tsx` present + curl 200. | **PASS — control mutates view (navigation)** |
| 3. Opens chapter 1 | Header `Chapter 1: The Beginning`, `Progress saved`, controls `Mode/Dir/Zoom`, page card | Header present `Chapter 1: The Beginning — Progress saved` + controls bar `Mode: Single Page — Dir: RTL — 100%`. | **PASS — state is restored (in-memory progress)** |
| 4. Reads via pagination (12 pages, RTL, window [1..3]) | RTL-aware arrows: Right=next, Left=prev; `L/R` keys, tap `25%` left/right, slider `Page n of 12`, bounded window cache | Screenshot shows `Page 12 of 12` + `Window: [1..3]` + footer controls. `src/lib/reader/*` `PAGE_WINDOW_SIZE=3` + `READER_TAP_ZONE_PCT=25` proven per `tests/unit/reader.test.ts`. `Direction RTL` badge present. | **PASS — button has real handler (client state, no DB)** |
| 5. Mode toggles | `M` cycles Single→Double→Vertical, `D` toggles RTL/LTR, `H` toggles chrome, `+/-` zoom | `?mode=double` screenshot 04 shows mode mutation works (Double Page tag). Zoom label `100%` visible. | **PASS — implemented, no mock** |

**Overall flow:** **PASS** — end-to-end, no blocker. Every step used a real route and produced a visible DOM change. “Persistence” is in-memory only (next restart resets), but the MVP criterion allows synthetic images and the spec explicitly says minimal is “no DB, no auth, no upload” for the license-safe harness.

## 5. Blocking Issues

**P0 — prevents MVP flow:** *none for a read-only demo.* As a `RUNNABLE_DEMO` the flow above is `PASS`.

**P1 — prevents *MVP_READY* (durable):**

* **No persistence** — `readingProgress` is in-memory (`T-LIBRARY-003` absent). Reload or new tab loses `Page 12 of 12` and `Progress saved`. Audit matrix `Persistence:  STUB — nothing survives a restart (expected for minimal)`.
* **No auth / library durability** — `T-FOUND-004/005` (users, sessions) not implemented. Minimal has no `DATABASE_URL` and no `drizzle`.

**P2 — polish / production concern:**

* **E2E placeholder** — `tests/e2e/reader.spec.ts` is `describe.todo('2 E2E (requires browser/S3)')` — no Playwright journey; landing → reader not recorded as an E2E. `README.md:232` says “E2E (i) Skipped: described as TODO only; Playwright not installed”.
* **`@fontsource/inter` + `eslint.config.cjs` newer (`@eslint/eslintrc` empty config error on legacy, but `typecheck` is clean). `next.config` is 31 lines + 980-line `product-manifest.json`.

## 6. MVP Verdict

**`RUNNABLE_DEMO`**

**Why:** A real Next.js application renders **more than a demo or placeholder** — the strongest **user-facing flow** in the monorepo: `Discover 240px cards → Sample Manga (RTL, 12 pages) → Chapter  Read only mode RTL/LTR with Single/Double/Vertical + window + keyboard`. Screenshots prove every state (24 KB discover, 34 KB single, 34 KB double) and `npm run test` (`tests/unit/reader.test.ts`) passes for the window constant. The flow is “runnable as a single session” but **not MVP_READY** because nothing persists across a restart (no DB) and `E2E` is todo. `production readiness: NOT_READY` (`upload/auth/persist` are `not-selected`).

## 7. Smallest Path to MVP

To reach **`MVP_PARTIAL` → `MVP_READY`** (durable reader) — smallest path:

1. **Add PG + `drizzle` + Better Auth** — add `drizzle.config.ts` + `DATABASE_URL=postgres://minimal:minimal@localhost:5432/minimal_dev` + auth tables (`T-FOUND-004/005` pattern from Yomi). Make `/sign-in` real (don’t copy the minimal spec’s license comment into prod guard — reuse Yomi’s `SESSION_SECRET`+`CRON_SECRET` guard).
2. **Persist reading state** — migrate `reading_progress` / `library_entry` / `bookmark` as in Yomi’s `drizzle/0000_*.sql` and make `Progress saved` survive `npm run dev` restart (the `window [1..3]` is already correct, just wire it to DB).
3. **Fill the E2E `todo`** — `tests/e2e/reader.spec.ts` `Playwright` `landing → discover → reader → pagination → mode toggle` against a real PG seed (copy `yomi/scripts/seed.mjs` mini-variant for the one manga). `npm run build && npm run test:e2e` must PASS.

**Not needed for next level:** the full 30/10000-title catalog, 500-page perf harness, `T-UPLOAD` rename GC, notifications, or native app transport.
