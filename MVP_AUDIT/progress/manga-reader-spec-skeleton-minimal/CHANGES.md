# Minimal Manga Reader — CHANGES

**Scope:** narrowest slice removing `P0 No persistence`. No Yomi-level complexity, no auth (guest `usr-guest-001` only).

## New files

- `data/db.json` (19K, file-backed, `data/db.json.tmp` atomic) — persists 3 manga, 5 chapters, progress; survives `npm run dev` restart.

## Modified files

- `src/server/db/store.ts` (151→ ~200 lines) — add `node:fs` + `node:path`, `dbPath = join(cwd,"data/db.json")`, `loadFromFile()` (Map deserialization), `persist()` (atomic JSON), `ensureSeed()` (idempotent add of manga-02/03 + ch-002..005), `seedDefaults()` now 3 manga + 5 chapters + demo progress `prog-demo-001:ch-001:5`, `saveProgress`/`savePreferences` now call `persist()`. No Drizzle, no Postgres, minimal deps.

- `src/app/discover/page.tsx` (hardcoded 1 card → `db.getPublishedMangaList()` + `db.getPublishedChaptersByMangaId()`, 3 cards with `Direction` + `chapters count` + `firstChapter` link).

- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` (static `SAMPLE_CHAPTER_MANIFEST` → dynamic `db.getMangaBySlug` + `getPublishedChaptersByMangaId` + `getChapterPages`, builds `ChapterManifest` with `nextChapterId/prevChapterId`, passes `chapterId`+`userId` to `ReaderView`).

- `src/features/reader/ReaderView.tsx` (fake `Saving...` timeout → real `fetch GET /api/v1/progress?chapterId=&userId=` on mount (restores saved page, shows `• restored 5`), `PUT /api/v1/progress` on `currentPage` change debounced 300ms, status `saving/saved/error`, `didLoadRef` guard prevents initial overwrite).

## Reused

- `src/app/api/v1/progress/route.ts` already existed (GET/PUT with `userId=usr-guest-001` default) — now backed by file, not memory.
- `src/features/reader/reader-core.ts` `calculateReaderWindow`, `displayIndex`, `stepPage`, `spreadFor`, `clamp` — window [1..3] still correct.
- `tests/unit/reader.test.ts` still PASS (window).

## Seed

- `seedDefaults()` 3 manga `manga-sample-01/02/03` slugs `sample-manga`, `sample-manga-2`, `sample-manga-3`, titles `The Licensed Adventure` I/II/III, rtl/ltr, 5 chapters `ch-001..005` (12/12/8/10/14 pages), assetKeys `asset://manga-${mangaId}/${chId}/p-${n}`.
- Progress `usr-guest-001:ch-001` 5 → 9 via UI, version 11, `data/db.json`.

## Evidence

- `BEFORE.md` — reproduces in-memory loss (discover 1 card, fake saving, 404 after restart, NON_DURABLE)
- `AFTER.md` — flow with IDs, 3 manga, progress 5→9, file 19K, restart DURABLE, 8 screenshots
- `screenshots/before/01-discover-single.png 24K`, `02-reader-page12.png 34K` (copied from baseline) + `screenshots/after/01-discover-3manga.png 25K … 08-mobile-reader.png 26K` (8 real browser, minimal args)
- `data/db.json` (not committed as artifact but shown in evidence)

## Ignored / not done

- No `T-AUTH-004` (auth), no `T-LIB-001`/`T-HIST-001` (library/history), no `T-UPLOAD`, no Postgres/Drizzle, no `S3`/`Sharp`, no `E2E` todo still `describe.todo`, no `T-SEC` probes.

## Commit

`feat(minimal): advance MVP from RUNNABLE_DEMO toward MVP_PARTIAL — file-backed progress` (next)
