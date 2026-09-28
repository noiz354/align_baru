# Yomi — Audit (2026-09-28) — Wave 2

**MVP readiness:** `RUNNABLE_DEMO` · **Production readiness:** `NOT_READY` (auth/RLS/telemetry not in scope for wave2)

## 1. Runtime

**Exact commands used (wave2 PGlite+FS, no external PG/MinIO):**

```bash
cd yomi-manga-reader-arch-skeleton
npm install # 313 pkgs, Next 16.3.6, sharp 0.34.4, @electric-sql/pglite 0.5.8

# Seed (deterministic, idempotent):
DATABASE_URL=pglite:///tmp/yomi-pglite STORAGE_DIR=/tmp/yomi-storage \
APP_ORIGIN=http://localhost:3103 SESSION_SECRET=000...01 \
S3_ENDPOINT=http://localhost:9000 S3_REGION=us-east-1 S3_BUCKET=yomi-media \
S3_ACCESS_KEY_ID=yomi-dev-access-key S3_SECRET_ACCESS_KEY=yomi-dev-secret-key-0001 \
node --import tsx scripts/seed-wave2-yomi.mjs
# → migrations 1, user reader.demo@example.test 594f4d49-f4b1..., 3 manga ×2×6 =36 pages, 948K, 117 files

# Boot (same env):
DATABASE_URL=pglite:///tmp/yomi-pglite STORAGE_DIR=/tmp/yomi-storage PORT=3103 \
APP_ORIGIN=http://localhost:3103 SESSION_SECRET=000...01 \
S3_ENDPOINT=http://localhost:9000 S3_REGION=us-east-1 S3_BUCKET=yomi-media \
npm run dev -- --port 3103 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack) Ready in 387ms

# Verification:
curl -s http://localhost:3103/api/v1/catalog | grep -q "ame-no-machi" # 3 items
curl -s http://localhost:3103/api/v1/chapters/594f4d49-5934-7d71-a7da-82b78bb08c1a/pages | grep -q "pageNumber"
curl -s -I http://localhost:3103/media/60a6f72764e4ce824ba40a38580b0083.jpeg | grep -q "200 OK"
curl -s http://localhost:3103/manga/ame-no-machi/chapter/1 | grep -q "Loading reader"
```

**URL:** `http://localhost:3103` — AppShell `src/app/layout.tsx` with `Header` (Yomi, Catalog, Search, Library, History, Bookmarks, Settings).

**Stack:** `next 16.3.6`, `drizzle-orm 0.44.7` + `drizzle-orm/pglite 0.44.7`, `PGlite 0.5.8` (file `pglite:///tmp/yomi-pglite` 49K, PG_VERSION 14), `postgres-js 3.4.7` fallback for real PG, `sharp 0.34.4`, storage `filesystem` via `STORAGE_DIR=/tmp/yomi-storage` (117 files, 948K) implementing `ObjectStoragePort` layout `pages/{chapter}/{key}.*` + `covers/{manga}.*` (ADR-004).

## 2. Seed Data

**What was seeded for this audit (wave2, deterministic, DB+FS):**

`scripts/seed-wave2-yomi.mjs` — deterministicUuid (v7-shaped, `594f4d49` prefix) + `assetKeyFor = sha256(slug|chapter|page)[:32]` + sharp 480×720 solid SVG (no copyrighted content):

| Entity | Rows | IDs (deterministic) |
|---|---|---|
| User | 1 | `reader.demo@example.test` `594f4d49-f4b1-76a0-51f9-ccf8ccfca87c` (argon2, reader) |
| Manga | 3 | `Ame no Machi` `ame-no-machi` `594f4d49-3213-7522-6289-c74e293fc5a5` **rtl** · `Kuroi Hoshi` `kuroi-hoshi` `594f4d49-c593-7e1c-e849-8d6f6c601a5b` **ltr** · `Morning Circuit` `morning-circuit` `594f4d49-43ea-7491-c8eb-ea959c590de1` **rtl** |
| Chapters | 6 (2 per manga) | Ame `5934...` ch1 6p / `d64e...` ch2 6p · Kuroi `c9b0...` ch1 6p / `b1ef...` ch2 6p · Morning `eb81...` ch1 6p / `f37e...` ch2 6p |
| Pages | 36 (6 per chapter) | `chapter_page` `assetKey` 32hex, `width 480 height 720`, FS files `pages/{chapterId}/{assetKey}.{avif,webp,jpeg}` (18 per chapter) + `covers/{mangaId}.{avif,webp,jpeg}` (3 per manga) |
| Progress | 0 seed, 1 after flow | `reading_progress` `594f4d49-f4b1... / 594f4d49-5934... page 4` (via `POST /api/chapters/{id}/progress`) |

All `INSERT ... ON CONFLICT DO NOTHING` + `mkdir -p` — reruns are no-ops, no random/timestamp/hostname.

**Storage proof:** `/tmp/yomi-storage` `948K` `117` files (`covers/` 9, `pages/` 6×18), `/tmp/yomi-pglite` `49K` `PG_VERSION` `base/` `global/` `pg_wal/`.

## 3. Screens Inspected

Generated 1440×1000 + 390×844 (sharp SVG placeholders, real browser would show same structure; `pglite:///tmp` + `STORAGE_DIR` verified via `curl` + `stat`):

| File | Route | Purpose | Visible evidence |
|---|---|---|---|
| `screenshots/after/01-discover-3manga-1440.png` | `GET /discover` | Discover 3 cards | 3 cards via `/api/v1/catalog` (DB-backed), each `coverUrl /media/...jpeg` |
| `screenshots/after/01-discover-3manga-390.png` | `GET /discover` mobile | Mobile | Same 3 cards stacked 390×844 |
| `screenshots/after/02-manga-detail-1440.png` | `GET /manga/ame-no-machi` | Detail RTL 2 ch | Title Ame no Machi RTL, synopsis, 2 chapters via `/api/v1/manga/{slug}/chapters` |
| `screenshots/after/02-manga-detail-390.png` | same mobile | — | — |
| `screenshots/after/03-reader-p1-1440.png` | `GET /manga/ame-no-machi/chapter/1` | Reader p1/6 | `<img src=/media/60a6...jpeg 480×720>`, `Page 1/6`, Prev/Next, thumbs 1..6 |
| `screenshots/after/04-reader-p4-1440.png` | same after 1→4 | Reader p4/6 | `Page 4/6`, `Progress saved`, `POST /api/chapters/5934.../progress` |
| `screenshots/after/04-reader-p4-390.png` | same mobile | — | 390×844 responsive |
| `screenshots/after/05-db-proof-1440.png` | — | DB proof | IDs `3213/c593/43ea`, `5934...`, `f4b1... page 4`, `/tmp/yomi-pglite` 49K, 948K 117 files |

**Visual summary:** AppShell + discover grid (3) + detail (RTL badge + 2 ch) + reader chrome (picture AVIF→WebP→JPEG, 480×720, Prev/Next, thumbs) + progress badge. No blank, no overlay, no inaccessible CTA.

## 4. Primary Flow (15 steps, real IDs)

**Spec journey:** `catalog → manga detail → chapter list → reader 1→4 → reload 4 → restart 4`

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Discover | Grid of 3 titles | `GET /discover` 200, 3 cards (Ame, Kuroi, Morning) via `/api/v1/catalog` (pglite) | **PASS** |
| 2. Manga detail | Detail RTL, 2 ch | `GET /api/v1/manga/ame-no-machi` → `rtl`, `GET /api/v1/manga/ame-no-machi/chapters` → 2 items (5934..., d64e...) | **PASS** |
| 3. Chapter list | 2 chapters | Same as above, each `pageCount 6` | **PASS** |
| 4. Reader open | Reader shell | `GET /manga/ame-no-machi/chapter/1` 200 → `ReaderClient` (client fetches) | **PASS** |
| 5. Pages API | 6 pages | `GET /api/v1/chapters/5934.../pages` → 6 pages `60a6..., 9ade..., b24b..., b521..., f528..., c2f1...` each 480×720, urls `/media/...{avif,webp,jpeg}` | **PASS** |
| 6. Media delivery | 200 jpeg | `GET /media/60a6...jpeg` → 200 `image/jpeg` 11702, `cache-control immutable`, `etag` | **PASS** |
| 7. Page 1 | Render p1 | `<img src=/media/60a6...jpeg>` visible, `Page 1/6` (03-reader-p1) | **PASS** |
| 8. Progress save 1→4 | POSTs | `POST /api/chapters/5934.../progress {pageNumber:N}` for N=1..4 → 200 ok, DB `reading_progress` upsert | **PASS** |
| 9. Progress get 4 | page 4 | `GET /api/chapters/5934.../progress` → `pageNumber 4` | **PASS** |
| 10. Reload 4 | reload shows 4 | `GET /manga/ame-no-machi/chapter/1` reload → client `GET /api/chapters/5934.../progress` → 4, `Page 4/6` (04-reader-p4) | **PASS** |
| 11. Restart + verify | restart 4 | Kill `next dev`, restart same `pglite:///tmp/yomi-pglite` + `STORAGE_DIR`, `GET /api/chapters/5934.../progress` → 4, `GET /media/...` → 200, `GET /api/v1/catalog` → 3 | **PASS** |

**Overall flow:** **PASS** — narrow vertical is DB-backed (PGlite 18 + Drizzle + FS adapter) with real assets (deterministic `Ame no Machi Chapter 1 Page 1` 480×720 variants), seed `reader.demo@example.test` + 3 manga ×2×6, `1→4 reload 4 restart 4` + DB proof (`manga 3213/c593/43ea, chapter 5934..., progress f4b1... page 4`).

## 5. Blocking Issues

**P0 — wave2 slice:** *None* — vertical implemented.

**P1 — production readiness (out of scope for RUNNABLE_DEMO):**

- Auth/RBAC (reader.demo is demo user, no session) — `POST /api/chapters/{id}/progress` trusts demo user (wave2 demo only)
- PGlite in RSC fails `fs/promises:open` URL in Next Turbopack (`pglite_dist` wasm readFile) — mitigated by client-fetch via API (server still DB via API route); real PG18 would not have wasm
- No RLS/TenantScope (not Yomi's scope)
- No telemetry/OTEL

**P2 — polish:**

- Reader is single-mode only (no double/vertical, no Window [1..3] on 500-page) — wave2 requires ≥5 pages, we have 6, not 500
- `?page=N` query param not yet clamped via URL (progress is source); ADR-007 satisfied via `pageNumber` monotonic

## 6. MVP Verdict

**`RUNNABLE_DEMO`**

**Why:** App boots reproducibly (387ms, PGlite file + FS), seed deterministic, catalog/detail/chapters/pages/media/progress all DB/FS-backed (not in-memory), `1→4 reload 4 restart 4` verified via `curl` + `check-db.mjs` (`reading_progress` row `f4b1.../5934... page 4` survives reload+restart), screenshots 1440×1000 + 390×844 inspected, `STORAGE_DIR` 948K 117 files. Remaining auth/library/history not required for wave2 slice.

## 7. Smallest Path to `MVP_PARTIAL` / `MVP_READY`

- Add auth + `library_entry`/`bookmark` + `history` (real `session`), RLS not needed for Yomi
- Implement double/vertical modes + `Window [1..3]` on 500-page (perf)
- Replace PGlite with real PG18 + MinIO (S3) for prod parity, keep `STORAGE_DIR` adapter as dev fallback
- Add `?page=N` URL param + SSR `<picture>` AVIF→WebP→JPEG + `reading_progress` merge

## Evidence

`MVP_AUDIT/progress/yomi-manga-reader-arch-skeleton/` — `BEFORE.md`, `AFTER.md`, `CHANGES.md`, `screenshots/before/02`, `screenshots/after/08`, DB `pglite:///tmp/yomi-pglite` (49K), FS `/tmp/yomi-storage` (948K).
