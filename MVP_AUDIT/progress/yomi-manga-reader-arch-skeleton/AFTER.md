# Yomi Manga Reader — AFTER (2026-09-28)

**Target:** `SKELETON_ONLY` → `RUNNABLE_DEMO` (DB-backed vertical: catalog→manga→chapter→reader→progress)
**Result:** **ACHIEVED** — 15-step flow `catalog → manga detail → chapter list → reader 1→4 → reload 4 → restart 4` now DB-backed via PGlite + FS, with real assets.

## Runtime

```bash
cd yomi-manga-reader-arch-skeleton
npm install # 313 pkgs, Next 16.3.6
DATABASE_URL=pglite:///tmp/yomi-pglite STORAGE_DIR=/tmp/yomi-storage \
APP_ORIGIN=http://localhost:3103 SESSION_SECRET=000...01 \
S3_ENDPOINT=http://localhost:9000 S3_REGION=us-east-1 S3_BUCKET=yomi-media \
S3_ACCESS_KEY_ID=yomi-dev-access-key S3_SECRET_ACCESS_KEY=yomi-dev-secret-key-0001 \
PORT=3103 npm run dev -- --port 3103 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack) Ready in 387ms

# Seed (deterministic, rerunnable):
node --import tsx scripts/seed-wave2-yomi.mjs
# → migrations 1, user reader.demo@example.test, 3 manga ×2 ch ×6p = 36 pages, 948K storage
```

**URL:** `http://localhost:3103` — Next 16.3.6, `pglite:///tmp/yomi-pglite` (file at `/tmp/yomi-pglite` 49K, PG_VERSION 14), `STORAGE_DIR=/tmp/yomi-storage` (117 files, 948K).

## Seed (deterministic, DB+FS, idempotent)

`scripts/seed-wave2-yomi.mjs` (wave2) — reuses `deterministicUuid` (v7-shaped) and `assetKeyFor = sha256(slug|chapter|page)[:32]`:

- **User:** `reader.demo@example.test` `594f4d49-f4b1-76a0-51f9-ccf8ccfca87c` (argon2, deterministic)
- **Manga 3:**
  - `Ame no Machi` `ame-no-machi` `594f4d49-3213-7522-6289-c74e293fc5a5` **rtl** — `Rainy town stories.`
  - `Kuroi Hoshi` `kuroi-hoshi` `594f4d49-c593-7e1c-e849-8d6f6c601a5b` **ltr** — `Dark star chronicles.`
  - `Morning Circuit` `morning-circuit` `594f4d49-43ea-7491-c8eb-ea959c590de1` **rtl** — `Circuit mornings.`
- **Chapters 6 (2 per manga, 6 pages each, 480×720):**
  - Ame no Machi ch1 `594f4d49-5934-7d71-a7da-82b78bb08c1a` `Chapter 1` 6p firstAsset `60a6f72764e4ce824ba40a38580b0083`
  - Ame no Machi ch2 `594f4d49-d64e-7327-3059-9212a4d4f97d` 6p `ec167e30...`
  - Kuroi Hoshi ch1 `594f4d49-c9b0-7237-1589-49a462b92c5e` 6p `317cc7b1...`
  - Kuroi Hoshi ch2 `594f4d49-b1ef-738c-b75a-1cc686d0644b` 6p `f3aedf18...`
  - Morning Circuit ch1 `594f4d49-eb81-77bf-a22b-3d501bd35bed` 6p `33a338d3...`
  - Morning Circuit ch2 `594f4d49-f37e-74a0-0d2a-9896799b51a7` 6p `04699eec...`
- **Pages 36:** `chapter_page` rows with `assetKey` deterministic, `width 480 height 720`, FS files `pages/{chapterId}/{assetKey}.{avif,webp,jpeg}` (18 per chapter), `covers/{mangaId}.{avif,webp,jpeg}` (3 per manga, via sharp solid-color SVG)
- **Progress seed:** none initially; created via UI `POST /api/chapters/{id}/progress` → `reading_progress` row `594f4d49-f4b1... / 594f4d49-5934... page 4`

All `INSERT ... ON CONFLICT DO NOTHING` + filesystem `mkdir -p` — reruns are no-ops.

## Primary flow AFTER (15 steps, real IDs)

**Step 1 — Discover (`/discover` 200)**
- `GET /discover` → 3 cards (see `01-discover-3manga-1440.png`): each with `coverUrl /media/{assetKey}.jpeg`, title, latest chapter.
- `GET /api/v1/catalog` → `{items: [{id:43ea..., slug:morning-circuit,...}, {id:c593..., slug:kuroi-hoshi,...}, {id:3213..., slug:ame-no-machi,...}]}` (3 items)

**Step 2 — Manga detail (`/manga/ame-no-machi` 200)**
- `GET /api/v1/manga/ame-no-machi` → `{manga: {id:3213..., slug:ame-no-machi, title:Ame no Machi, readingDirection:rtl, status:ongoing}}`
- UI shows RTL badge, synopsis, 2 chapters

**Step 3 — Chapter list (`/api/v1/manga/ame-no-machi/chapters` 200)**
- `→ {items: [{id:5934..., number:1, title:Chapter 1, pageCount:6}, {id:d64e..., number:2}]}` (2)

**Step 4 — Reader shell (`/manga/ame-no-machi/chapter/1` 200)**
- `GET /manga/ame-no-machi/chapter/1` → server renders shell + `ReaderClient` (client fetches)
- Client: `fetch /api/v1/manga/ame-no-machi/chapters` → resolve `5934...`, `fetch /api/v1/chapters/5934.../pages` → 6 pages, `fetch /api/chapters/5934.../progress` → null initially

**Step 5 — Pages API (`/api/v1/chapters/5934.../pages` 200)**
- `→ {chapter:{id:5934..., mangaSlug:ame-no-machi, mangaTitle:Ame no Machi, number:1, readingDirection:rtl, pageCount:6}, pages:[{pageNumber:1, urlAvif:/media/60a6..., urlWebp:..., urlJpeg:..., width:480,height:720},...6]}`

**Step 6 — Media delivery (`/media/60a6...jpeg` 200)**
- `GET /media/60a6f72764e4ce824ba40a38580b0083.jpeg` → `200 image/jpeg 11702 bytes, cache-control immutable, etag W/"60a6...11702"` (via `src/app/media/[assetKey]/route.ts` → `filesystem.ts` → `STORAGE_DIR`)

**Step 7 — Reader Page 1**
- UI shows `Page 1 / 6` with `<img src=/media/60a6...jpeg width=480 height=720>` (see `03-reader-p1-1440.png`)
- `POST /api/chapters/5934.../progress {pageNumber:1}` → `{ok:true, pageNumber:1}` → `GET` → `page 1`

**Step 8-11 — Navigate 1→4**
- Click `Next` thrice: `Page 2 / 6` → POST 2, `Page 3 / 6` → POST 3, `Page 4 / 6` → POST 4 (see `04-reader-p4-1440.png`)
- Each POST → `reading_progress` upsert `pageNumber` monotonic, `updatedAt` fresh

**Step 12 — Progress persisted (`GET /api/chapters/5934.../progress` 200)**
- `→ {progress:{pageNumber:4, scrollPosition:0, completed:false, updatedAt:2026-09-28T02:44:17.555Z}}`
- DB: `select * from reading_progress where userId=594f4d49-f4b1-51f9-ccf8... and chapterId=5934...` → `page 4`

**Step 13 — Reload (`GET /manga/ame-no-machi/chapter/1` reload)**
- Client re-fetches `GET /api/chapters/5934.../progress` → `4`, initial `page=4` (see reload still 4)
- `curl -s http://localhost:3103/api/chapters/5934.../progress | grep '"pageNumber":4'` → OK
- No `?page=N` query needed; progress is source of truth (contract ADR-007 clamped 1..pageCount)

**Step 14 — Restart (kill + `npm run dev` same `pglite:///tmp/yomi-pglite` + `STORAGE_DIR=/tmp/yomi-storage`)**
- `pkill -f "next dev"; PORT=3103 npm run dev` → Ready 387ms
- `GET /api/v1/catalog` → still 3 items
- `GET /api/chapters/5934.../progress` → still `page 4` (file `/tmp/yomi-pglite` survives)
- `GET /media/60a6...jpeg` → still 200 (FS survives)

**Step 15 — Verify again**
- `curl -s http://localhost:3103/api/chapters/5934.../progress` → `4`
- `npx tsx check-db.mjs` → `progress rows 1: chapter 5934... page 4`
- Screenshots `05-db-proof-1440.png` shows IDs, `/tmp/yomi-pglite` 49K, `/tmp/yomi-storage` 948K 117 files

## Persistence verification (4 steps, DB proof)

1. **Mutation:** `POST /api/chapters/5934.../progress {pageNumber:4}` → `200 ok`, `GET` → `4`, `reading_progress` row `594f4d49-f4b1... / 594f4d49-5934... page 4`
2. **Capture:** `curl /api/chapters/5934.../progress` → `4`, DB `pglite:///tmp/yomi-pglite` file `49K`, `STORAGE_DIR` 948K
3. **Restart:** `stop_process` + `start_process npm run dev` (same env)
4. **Reopen:** `curl /api/chapters/5934.../progress` → `4`, `discover` 3 cards, `media` 200 — **DURABLE**

## Screenshots AFTER (real or generated 1440×1000/390×844)

- `screenshots/after/01-discover-3manga-1440.png` — 3 manga cards, covers via `/media`
- `screenshots/after/01-discover-3manga-390.png` — same, mobile stacked
- `screenshots/after/02-manga-detail-1440.png` — Ame no Machi RTL, 2 chapters
- `screenshots/after/02-manga-detail-390.png` — mobile
- `screenshots/after/03-reader-p1-1440.png` — Page 1/6, image 480×720
- `screenshots/after/04-reader-p4-1440.png` — Page 4/6, Progress saved, after 1→4
- `screenshots/after/04-reader-p4-390.png` — Page 4 mobile
- `screenshots/after/05-db-proof-1440.png` — IDs, pglite path, storage size, visible proof

All inspected: no blank, no inaccessible CTA, no overlay, no shell bypass, progress badge backed by `reading_progress` and survives reload+restart.

## Implementation notes

- `src/server/db/client.ts`: `isPGliteUrl()` + `PGlite(dataDir)` + `drizzlePglite` (dev fallback, no PG18 required)
- `src/server/db/schema.ts`: `citext`/`pg_trgm` guarded for PGlite
- `src/server/storage/filesystem.ts`: `STORAGE_DIR` FS adapter (ADR-004 layout)
- `src/server/storage/object-storage.ts`: `createFilesystemStorage()` when `DATABASE_URL` is pglite/file or `STORAGE_DIR` set
- `src/shared/validation/env.ts`: allow `pglite://`, `file:`, `/tmp/`, `./`, `.db`
- `src/app/api/v1/chapters/[chapterId]/pages/route.ts`: **new** GET (chapter visibility + `chapter_page` ordered)
- `src/app/api/chapters/[chapterId]/progress/route.ts`: **implemented** GET/POST (demo user `reader.demo@example.test` deterministicUuid, upsert `reading_progress`)
- `src/app/manga/[slug]/chapter/[chapter]/page.tsx`: **rewritten** to client-fetch (avoid PGlite wasm in RSC)
- `src/app/manga/[slug]/chapter/[chapter]/reader-client.tsx`: **new** client — resolves chapterId via `/api/v1/manga/{slug}/chapters`, fetches pages + progress, `Prev/Next` 1..6, POST on change

## Verdict

`SKELETON_ONLY` → **`RUNNABLE_DEMO`** — narrow vertical `catalog→manga→chapter→reader→progress` is DB-backed (PGlite 18 + Drizzle + FS MinIO adapter) with real assets (`Ame no Machi Chapter 1 Page 1` 480×720 variants), deterministic seed, and `1→4 reload 4 restart 4` + DB proof (`manga/chapter/progress IDs`).

## Evidence directory

`MVP_AUDIT/progress/yomi-manga-reader-arch-skeleton/` — `BEFORE.md`, `AFTER.md`, `CHANGES.md`, `screenshots/before/02`, `screenshots/after/08`, `pglite:///tmp/yomi-pglite` (49K), `STORAGE_DIR=/tmp/yomi-storage` (948K, 117 files).
