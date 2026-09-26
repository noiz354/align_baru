# ADR-007: Reader Architecture

Status: Accepted
Date: 2026-09-26

## Context

The reader is the product's centerpiece and its hardest performance problem: 3 modes (vertical, single, double) × 2 directions (RTL/LTR) × keyboard/mouse/touch inputs, zoom, fullscreen, bounded memory, 500-page chapters, slow connections (FR-READER-001…024, NFR-PERF-006/010/011/012/015). The decision: *where* reading happens and *how* pages are managed.

## Decision Drivers

1. Memory boundedness is a hard invariant (NFR-PERF-010) — the design must make unbounded growth structurally impossible, not merely unlikely.
2. First-page latency (NFR-PERF-006) — no heavy client payload before the first page paints.
3. Simplicity/reviewability for agent implementation — few moving parts, explicit state machine.
4. Progressive enhancement: keyboard-first, touch on top.
5. No canvas dependency for v1 (a11y: real `<img>` elements give alt text, native semantics for free — NFR-A11Y-005).

## Options Considered

### Option A — Client-side DOM reader over a page-list API, with a bounded loading window

SSR shell (chapter metadata + first page URL) + a Client Component that owns `ReaderState` (docs/product/reader-behavior.md §10). Pages are `<img>`/`<picture>` elements; a window calculator (`calculateReaderWindow`, NFR-PERF-011) decides which pages are loaded/queued/evicted; a residency cap (NFR-PERF-010) evicts decoded images far from the active page. Image bytes stream from `/media/{assetKey}` (ADR-004/005).

### Option B — Virtualized list (e.g., react-virtuoso) rendering all pages

Virtualization gives DOM recycling but still relies on the browser cache for image bytes; it optimizes DOM nodes (cheap) while the real cost is *decoded image memory* (expensive) — which requires explicit eviction either way. A custom window gives both DOM and decoded-byte control with less library coupling.

### Option C — Canvas-based reader (tile/decode to canvas)

Maximum memory control, but: loses native `<img>` semantics (alt text, a11y), reimplements zoom/pan, multiplies code surface, and is only justified at extreme image counts (thousands of pages). Our cap is 500 pages (NFR-SEC-007) — canvas is overkill for v1.

### Option D — SSR page chunks (server splits the chapter into sub-pages)

Regresses: each "page turn" is a navigation (slow, loses scroll/zoom state), no offline-ish smoothness, and server load proportional to reads.

## Decision

**Option A.** Concrete shape:

1. **Page data:** `GET /api/v1/chapters/{id}/pages` returns the full ordered page list (ids, dimensions, variant URLs) — a ~500-row JSON, well under budget (NFR-PERF-008). No per-page API calls.
2. **State:** single `ReaderState` (chapterId, currentPage, totalPages, readingMode, readingDirection, zoom, fullscreen, loadedWindow, progressStatus) in a client store; all transitions go through one reducer with invariants (FR-READER-023: indices always clamped 1..M; FR-READER-004/005: direction flips navigation semantics).
3. **Window:** `calculateReaderWindow(currentPage, totalPages, mode)` → `{ start, end }`; mode-aware sizes (vertical ±3; paged +2 ahead/−1 behind), hard-capped (NFR-PERF-011). Pure function → unit-testable (T-READER-031/032/033).
4. **Residency:** only images inside the window hold decoded bytes; on scroll, out-of-window `<img>` are dropped (src removed / element recycled). Cap: 12 decoded images (NFR-PERF-010).
5. **Failure handling:** per-image error → placeholder + retry button + one automatic retry (FR-READER-018); telemetry beacon (NFR-OBS-007).
6. **Progress:** local-first (always), server-sync when authenticated (debounced 1 s in vertical, immediate on page turn in paged) (FR-READER-013/014, NFR-DATA-003).
7. **Completion:** last page visible ≥ 1 s or explicit mark → completed=true → next-chapter CTA (FR-READER-017/024).

## Consequences

### Positive
- Memory bound is *structural*: window + residency cap are invariants enforced by one reducer; 500-page chapters behave like 10-page ones at the memory level.
- First page is an SSR `<img>` — paints before any client JS (NFR-PERF-006).
- `<img>`/`<picture>` gives a11y (alt text), `<picture>` format ladder (FR-MEDIA-002), and browser disk cache for revisits.
- All hard logic is small pure functions (window, clamp, pairing) → unit-tested, agent-safe.

### Negative
- We own gesture/tap-zone/zoom code (no library does all 3 modes × 2 directions correctly).
- Browser disk-cache eviction under 500-page chapters on low-storage phones means re-fetches on revisit (mitigated by immutable caching + small variant sizes; acceptable).

## Risks

- **R1:** Eviction causes visible re-load on back-scroll. → Window hysteresis (evict at 2× the load distance) + disk cache; measured in T-PERF-005/007.
- **R2:** iOS Safari memory pressure kills large decoded images earlier than the cap. → Residency cap is conservative (12); monitor `reader.page_load_error` (NFR-OBS-007) for device-pattern spikes.
- **R3:** Mode/direction switch mid-chapter desyncs position. → Transition rules are specified (reader-behavior.md §11: page mapping table) and unit-tested (T-READER-030).

## Mitigations

Pure-function core (no side effects in window/clamp/pairing); E2E covers mode/direction matrix on 3 viewports (E2E-READER-*); performance gates at VS-4 exit (500-page matrix, T-PERF-005/007).

## Revisit When

- Chapter cap is raised > 1000 pages (revisit canvas/tiling — new ADR).
- WebCodecs-based decoding shows a material memory win on target devices (experiment at VS-4, decision after data).
- A library appears that does bounded-window image readers well (re-evaluate coupling).

## References

- docs/product/reader-behavior.md (full behavior + state spec), PERFORMANCE.md §3–5, ADR-004/005 (delivery), PRD FR-READER-* / NFR-PERF-*
