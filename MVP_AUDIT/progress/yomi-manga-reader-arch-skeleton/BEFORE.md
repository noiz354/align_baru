# Yomi Manga Reader — BEFORE (2026-09-28)

**Baseline:** `SKELETON_ONLY` (commit `cc80bac` / tag `mvp-wave2-baseline-cc80bac`) — AppShell only, no PG seed, no reader vertical.
**Blocker:** `No DB-backed catalog/reader/progress — Discover shows error boundary, Reader is stub (T-READER-001/003/022), no persistence.`

## Reproduction (wave2 locked baseline cc80bac)

```bash
cd yomi-manga-reader-arch-skeleton
npm install # 313 pkgs, Next 16.3.6
# No DATABASE_URL=pglite, no STORAGE_DIR — boot without DB:
DATABASE_URL=postgres://yomi:yomi@localhost:5432/yomi_dev npm run dev -- --port 3103 --hostname 0.0.0.0
# → Ready in 946ms

curl -s http://localhost:3103/discover | grep -E "The catalog is unavailable|Filters"
# → error boundary "The catalog is unavailable — Cause. The list of titles could not be read just now."

curl -s http://localhost:3103/api/v1/catalog | head
# → 500 (no DB)

curl -s http://localhost:3103/api/v1/chapters/594f4d49-5934-7d71-a7da-82b78bb08c1a/pages
# → 404 (route not existent: src/app/api/v1/chapters/[chapterId]/pages missing)

curl -s http://localhost:3103/manga/ame-no-machi/chapter/1 | grep -E "Chapter|TODO"
# → <h1>Chapter</h1> + TODOs T-READER-001/003/028/029 (skeleton)

cat src/app/api/chapters/[chapterId]/progress/route.ts
# → throw new Error('Not implemented: T-READER-022');

ls src/app/api/v1/chapters
# → No such file or directory

ls src/app/manga/\[slug\]/chapter/\[chapter\]/page.tsx
# → skeleton: export default function ReaderPage(){return <><h1>Chapter</h1> TODOs>}
```

**Evidence:**

- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` is skeleton (no DB, no `<picture>`, no `?page=N`, no progress)
- `src/app/api/chapters/[chapterId]/progress/route.ts` throws `Not implemented`
- `src/app/api/v1/chapters/[chapterId]/pages` does not exist → fetch returns 404
- `src/app/media/[assetKey]/route.ts` exists but storage is S3-only (no filesystem fallback for pglite)
- `src/server/db/client.ts` refuses `pglite://` (must be postgres://) → blocks dev without PG18
- `src/server/storage/object-storage.ts` has no filesystem adapter → media 404 without MinIO
- `MVP_AUDIT/projects/yomi-manga-reader-arch-skeleton/AUDIT.md` → `SKELETON_ONLY` with screenshots `01-home.png` (AppShell only), `02-discover.png` (error boundary), no reader

## Primary flow before

*Catalog → manga detail → chapter list → reader → progress (15-step wave2)*

- Discover → error boundary, 0 cards (FAIL)
- Manga detail → `not-found` (no DB row)
- Chapter list → not implemented
- Reader → stub `<h1>Chapter</h1>`
- Progress → `Not implemented` 500
- Media → 404 (no bytes)

**Overall:** `SKELETON_ONLY` — correct for baseline, but no vertical slice. Ready for narrowest slice: PG18 PGlite + FS storage + seed + pages/progress APIs + client reader.
