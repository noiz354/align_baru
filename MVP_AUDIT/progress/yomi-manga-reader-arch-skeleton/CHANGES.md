# Yomi Manga Reader — CHANGES (2026-09-28)

**Branch:** `arena/01a0e54f-align-baru`
**Baseline:** `cc80bac` (tag `mvp-wave2-baseline-cc80bac`)
**Scope:** Wave 2 project 6 only — narrow vertical `catalog → manga detail → chapter list → reader → progress` via PGlite + FS, reusing existing repository/service boundaries.

## Files changed (vs baseline)

- `src/server/db/client.ts` — allow `pglite://`, `file:`, `memory:`, `/tmp/`, `./`, `.db` via `isPGliteUrl()`; use `drizzle-orm/pglite` + `PGlite(dataDir)` when pglite URL, else `postgres-js`. `DB_POOL_MAX 10`, `select 1` round-trip.
- `src/server/db/columns.ts` — guard `citext`/`pg_trgm` for PGlite (text fallback)
- `src/server/db/schema.ts` — same guard, `pg_trgm` not required on PGlite
- `src/server/db/migrations.ts` — run migrations on PGlite via `drizzlePglite`
- `drizzle/0000_initial_schema.sql.orig` — original preserved (for diff)
- `src/server/storage/object-storage.ts` — when `DATABASE_URL` is pglite/file or `STORAGE_DIR` set or `YOMI_STORAGE=filesystem`, delegate to `createFilesystemStorage()` (lazy require)
- `src/server/storage/filesystem.ts` — **new** (or patched) FS adapter: `STORAGE_DIR ?? join(cwd, storage)` root, `keyToPath` via `join`, `putStream/getStream/head/exists/delete`, `contentTypeForKey` by ext, `ObjectStoragePort` layout `pages/{chapter}/{key}.{ext}` / `covers/{manga}.{ext}`
- `src/shared/validation/env.ts` — `postgresDsn` refine allows `pglite://`, `file:`, `memory:`, `/tmp/`, `./`, `.db`
- `src/app/api/v1/chapters/[chapterId]/pages/route.ts` — **new** `GET /api/v1/chapters/{chapterId}/pages` (200 with `{chapter, pages:[{pageNumber,urlAvif/Webp/Jpeg,width,height}]}` ordered, 404/409 `CHAPTER_NOT_FOUND/_NOT_READY/MANGA_NOT_FOUND`)
- `src/app/api/chapters/[chapterId]/progress/route.ts` — **implemented** `GET/POST /api/chapters/{chapterId}/progress` (demo user `reader.demo@example.test` deterministicUuid `594f4d49-f4b1...`, `reading_progress` upsert, clamp 1..pageCount, 422/404)
- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` — **rewritten** from skeleton `TODO` to server shell that renders `ReaderClient` (avoids PGlite wasm in RSC which fails `fs/promises:open` URL in Next Turbopack)
- `src/app/manga/[slug]/chapter/[chapter]/reader-client.tsx` — **new** client: resolves `chapterId` via `fetch /api/v1/manga/{slug}/chapters` → finds `number===chapterNumber`, fetches `GET /api/v1/chapters/{id}/pages` + `GET /api/chapters/{id}/progress`, renders `Page N / 6` with `Prev/Next`, thumbnails 1..6, `POST /api/chapters/{id}/progress` debounce 300ms, reload shows persisted page
- `scripts/seed-wave2-yomi.mjs` — **new** deterministic seed: 3 manga (Ame no Machi RTL, Kuroi Hoshi LTR, Morning Circuit RTL) each 2 chapters ×6 pages (36 pages, 480×720 sharp SVG solid), FS files 117 (948K), `manga/chapter/chapter_page` rows, `reader.demo@example.test` user, idempotent `ON CONFLICT DO NOTHING`

## Files not changed (frozen 1–5)

- `parking-attendant-ops-app-spec`, `manga-reader-spec-skeleton-minimal`, `siomayops-streetfood-stall-ops-spec`, `strangerlink-random-chat-webrtc-spec`, `rsi-agent-recursive-self-improvement-prototype` — no edits, history preserved.

## Migrations

- `drizzle/0001_*.sql` not needed — PGlite applies `0000_initial_schema.sql` via `runMigrations` (patched to not require `citext`/`pg_trgm`).

## Verification (15 steps)

```
DATABASE_URL=pglite:///tmp/yomi-pglite STORAGE_DIR=/tmp/yomi-storage \
APP_ORIGIN=http://localhost:3103 SESSION_SECRET=...01 PORT=3103 npm run dev -- --port 3103
# 1 discover 200, 2 catalog 3 items, 3 manga rtl, 4 chapters 2, 5 pages 6, 6 media 200,
# 7 reader shell Loading, 8 progress null→1, 9-12 POST 1→4, 13 GET 4, 14 reload 4, 15 restart 4
pglite:///tmp/yomi-pglite 49K, /tmp/yomi-storage 948K 117 files
DB proof: manga 3213/c593/43ea, chapter 5934..., progress user f4b1... page 4
```

## Next (wave2)

- Project 7 `majelishub-pengajian-event-platform-spec` — organization→mosque→event with RLS
- Project 8 `homeops-household-manager-spec` — household→rooms→chores→Today
- Final `MVP_AUDIT/MVP_MATRIX_FINAL.md` + `READINESS_PROGRESS.md` after 6–8.
