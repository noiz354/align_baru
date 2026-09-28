# Minimal Manga Reader — BEFORE (2026-09-28)

**Baseline:** `RUNNABLE_DEMO` (commit `7641230`) — in-memory demo-only state, strongest user-facing flow but no durability.
**Blocker:** `No persistence — readingProgress is in-memory (T-READER-021 absent). Reload or new tab loses Page 12 of 12 and Progress saved.`

## Reproduction

```bash
cd manga-reader-spec-skeleton-minimal
PORT=3202 npm run dev -- --port 3202 --hostname 0.0.0.0 &
curl -s http://localhost:3202/discover | grep "The Licensed Adventure"  # → 1 card only
curl -s http://localhost:3202/manga/sample-manga/chapter/1 | grep "Progress saved"  # → simulated
# In-memory store:
cat src/server/db/store.ts | grep "class MemoryDatabase"  # → Map<string, ProgressRecord> in-memory
# Progress simulation:
grep -A2 "Save progress simulation" src/features/reader/ReaderView.tsx  # → setTimeout 300ms, no fetch
# Check API (in-memory, not file)
curl -s "http://localhost:3202/api/v1/progress?chapterId=ch-001&userId=usr-guest-001"  # → 404 before any save
curl -s -X PUT http://localhost:3202/api/v1/progress -H "Content-Type: application/json" -d '{"chapterId":"ch-001","pageNumber":5}' | python3 -m json.tool  # → saved but in-memory
curl -s "http://localhost:3202/api/v1/progress?chapterId=ch-001" | python3 -m json.tool  # → shows 5
# Restart app:
pkill -f "next dev" ; PORT=3202 npm run dev ... &
curl -s "http://localhost:3202/api/v1/progress?chapterId=ch-001"  # → 404 again — lost
```

**Evidence:**

- `src/server/db/store.ts` `MemoryDatabase` has `progress: Map` with `seedDefaults()` only one manga `manga-sample-01` + `ch-001` 12 pages, no file.
- `src/features/reader/ReaderView.tsx` `useEffect` for progress is fake: `setProgressStatus("saving"); setTimeout(()=>setProgressStatus("saved"),300)` — no `fetch`.
- `src/app/discover/page.tsx` hardcodes `mangaList = [{id:"sample-manga", title:"The Licensed Adventure", ...}]` — only 1 card, not 3.
- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` uses `SAMPLE_CHAPTER_MANIFEST` static, not DB chapters.
- Screenshots before (unmodified):
  - `screenshots/before/01-discover-single.png` — 1 card, 24K
  - `screenshots/before/02-reader-page12.png` — Page 12, Progress saved (simulated), Window [1..3]
  - `screenshots/before/03-reload-lost.png` — after reload, Page 1 again (not 12), proving NON_DURABLE

## Primary flow before

*Discover → manga detail → chapter → move through pages → progress saved → reload → progress remains*

- Discover shows 1 manga (PASS but incomplete seed)
- Reader shows Page 12 with `Progress saved` (PASS but simulated, not API)
- Reload: `initialPage` from `searchParams.page` defaults to 1, `ReaderView` resets to `clamp(1,1,12)=1` — progress lost. `GET /api/v1/progress` returns 404 after restart, confirming **NON_DURABLE**.

## Visual inspection before

- No blank, but `01-discover` only 1 card (missing 3-manga seed)
- `ReaderView` "Progress saved" is not backed by DB — inspection of `ReaderView.tsx` line 74-78 shows no `fetch`.

## Conclusion

Blocker reproduced: progress is ephemeral, discover is single-manga, file `data/db.json` does not exist. Ready for narrowest slice: file-backed `MemoryDatabase` + discover 3 manga + ReaderView real `PUT/GET /api/v1/progress`.
