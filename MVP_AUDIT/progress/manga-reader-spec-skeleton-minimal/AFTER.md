# Minimal Manga Reader — AFTER (2026-09-28)

**Target:** `RUNNABLE_DEMO` → `MVP_PARTIAL` (durable progress)
**Result:** **ACHIEVED** — `Discover → manga detail → chapter → move through pages → progress saved → reload → progress remains` now durable via file `data/db.json`.

## Runtime

```bash
cd manga-reader-spec-skeleton-minimal
npm install --legacy-peer-deps  # 78 pkgs
npm run dev -- --port 3202 --hostname 0.0.0.0  # → http://localhost:3202
curl http://localhost:3202/discover | grep "The Licensed Adventure"  # → 3 cards
curl http://localhost:3202/api/v1/progress?chapterId=ch-001  # → {pageNumber:9, version:11}
```

**URL:** `http://localhost:3202` — Next 15.5.26, `src/server/db/store.ts` file-backed `data/db.json` (19K, 3 manga, 5 chapters, progress).

## Seed (deterministic, file-backed, idempotent)

`data/db.json` (created on first boot via `MemoryDatabase.loadFromFile()` else `seedDefaults()` + `persist()`) contains:

- Reader `usr-guest-001` reader@domain.local
- 3 manga:
  - `manga-sample-01` `sample-manga` "The Licensed Adventure" rtl — 1 chapter
  - `manga-sample-02` `sample-manga-2` "The Licensed Adventure II" rtl — 2 chapters (12p + 8p)
  - `manga-sample-03` `sample-manga-3` "The Licensed Adventure III" ltr — 2 chapters (10p + 14p)
- 5 chapters:
  - `ch-001` manga-sample-01 Chapter 1: The Beginning 12p
  - `ch-002` manga-sample-02 Chapter 1: Shadows 12p
  - `ch-003` manga-sample-02 Chapter 2: Light 8p
  - `ch-004` manga-sample-03 Chapter 1: Origin 10p
  - `ch-005` manga-sample-03 Chapter 2: Return 14p
- Progress seed: `prog-demo-001` `usr-guest-001:ch-001` page 5 → updated to 9 via UI, version 11, `updatedAt 2026-09-28T01:15:15.899Z`

All IDs synthetic, `ON CONFLICT` style via `ensureSeed()` (adds missing without wiping progress).

## Primary flow AFTER (with real IDs)

**Step 1 — Discover**
- `GET /discover` → 3 cards (see `01-discover-3manga.png` 25K): `The Licensed Adventure` (1 ch, RTL, Start at 1), `II` (2 chs, RTL), `III` (2 chs, LTR) — each `Cover Art` + `Read Chapter 1` CTA.
- Uses `db.getPublishedMangaList()` + `db.getPublishedChaptersByMangaId()` (not hardcoded).

**Step 2 — Manga detail → chapter**
- `GET /manga/sample-manga/chapter/1` → server `db.getMangaBySlug("sample-manga")` + `db.getPublishedChaptersByMangaId` → chapter `ch-001` manifest 12 pages (see `src/app/manga/[slug]/chapter/[chapter]/page.tsx`).
- UI: `ReaderView` with `manifest` + `chapterId ch-001` + `userId usr-guest-001`.

**Step 3 — Move through pages**
- Initial load: `GET /api/v1/progress?chapterId=ch-001&userId=usr-guest-001` → 5 (seed), then after navigation `PUT /api/v1/progress {chapterId:"ch-001",pageNumber:9}` → 9.
- UI: `ReaderView` header `Chapter 1: The Beginning — Progress saved • restored 5` (see `02-reader-restored-5.png` 30K), controls `Mode: Single`, `Dir: RTL`, `100%`, `Page 5 of 12`, `Window [1..3]`. Navigation via `Next` button (RTL-aware) or `ArrowRight/Left`, `M/D/H`, slider, tap zones 25%.
- Screenshots: `03-reader-navigated-9.png` 30K (page 9, `Saving...`), `04-reader-progress-saved-9.png` 30K (`Progress saved • restored 5` → now `9`), window `[7..9]` etc.

**Step 4 — Progress saved (durable)**
- `PUT /api/v1/progress` → `{"id":"prog-demo-001","userId":"usr-guest-001","chapterId":"ch-001","pageNumber":9,"version":11}` (see API logs, `data/db.json` progress entry).
- `src/server/db/store.ts` `saveProgress` calls `this.persist()` → `data/db.json.tmp` → `data/db.json` (19K) — file-backed, not memory.

**Step 5 — Reload → progress remains**
- `GET /api/v1/progress?chapterId=ch-001` after reload → 9 (see `05-reload-still-9.png` 30K, page 9 still, `Progress saved • restored 9`).
- `curl -s http://localhost:3202/api/v1/progress?chapterId=ch-001` before/after restart both 9 (see persistence verification).

**Step 6 — Other manga**
- `06-manga2-ch1.png` 30K — `sample-manga-2` chapter 1 (Shadows, 12p, RTL) loads independently, progress per chapter isolated.

## Persistence verification

1. **Mutation:** PUT `ch-001` page 5 → navigate to 9 → PUT 9 (version 11), `GET` → 9, `data/db.json` shows `usr-guest-001:ch-001 9`.
2. **Capture:** `curl /api/v1/progress?chapterId=ch-001` → 9, `cat data/db.json` → 9.
3. **Restart:** `stop_process` + `start_process npm run dev -- --port 3202` (same `data/db.json`).
4. **Reopen:** `curl /api/v1/progress?chapterId=ch-001` → 9, `discover` still 3 manga.
5. **Verify:** state exists after restart — **DURABLE** (file `data/db.json` 19K survives, not `NON_DURABLE`). Earlier in-memory would have 404 after restart; now 200.

## Screenshots AFTER (1440×1000, real browser, minimal args)

- `screenshots/after/01-discover-3manga.png` 25K — 3 cards, Cover Art, RTL/LTR, chapters count
- `screenshots/after/02-reader-restored-5.png` 30K — Page 5, Progress saved • restored 5, RTL, window [3..5]
- `screenshots/after/03-reader-navigated-9.png` 30K — Page 9, Saving...
- `screenshots/after/04-reader-progress-saved-9.png` 30K — Page 9, Progress saved, version 11
- `screenshots/after/05-reload-still-9.png` 30K — after reload, still Page 9, Progress saved • restored 9
- `screenshots/after/06-manga2-ch1.png` 30K — second manga chapter, independent
- `screenshots/after/07-mobile-discover.png` 36K — mobile 390×844, 3 cards stacked
- `screenshots/after/08-mobile-reader.png` 26K — mobile reader, touch targets

All inspected: no blank, no inaccessible CTA, no overlay, no shell UI, no placeholder in critical path. Progress badge `Progress saved` is now backed by `data/db.json` and survives reload.

## Verdict

`RUNNABLE_DEMO` → **`MVP_PARTIAL`** (durable reader) — minimal PRD now satisfied for `T-READER-021` without auth. Remaining P0: auth (T-AUTH-004), library/history durability, E2E todo, upload/media.

## Evidence directory

`MVP_AUDIT/progress/manga-reader-spec-skeleton-minimal/` — `BEFORE.md`, `AFTER.md`, `CHANGES.md`, `screenshots/before/02`, `screenshots/after/08`, `data/db.json` (19K).
