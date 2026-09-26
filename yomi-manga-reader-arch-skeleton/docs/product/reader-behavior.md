# Reader Behavior Specification

Status: Authoritative for all reader implementation tasks (T-READER-*). This is *specification only* — no behavior is implemented in the architecture phase. Where this document and the PRD differ, the PRD's requirement ID wins and this document must be fixed (raise a spec task).

## 1. Scope & Design Frame

The reader presents a **published chapter** (a 1..N ordered page set) in one of three **modes** and one of two **directions**, with full keyboard/mouse/touch input, zoom, fullscreen, bounded memory, and progress persistence.

- Modes: `vertical` (default), `single`, `double`.
- Directions: `rtl` (manga default), `ltr` (Western comics). Source: manga.readingDirection, overridable per user (ReaderPreference.directionOverride, FR-READER-021).
- The reader is a **Client Component** under an SSR shell (ADR-007). The SSR shell paints page 1 (or the restored page) before hydration.

## 2. Layout & Viewports (FR-READER-011)

| Breakpoint | Reader width | Chrome | Mode defaults |
|---|---|---|---|
| < 640 px (mobile portrait) | full viewport width | bottom bar (prev/next, mode, more) | vertical |
| 640–1023 px (tablet) | min(92vw, 880 px) | right rail (collapsible) | vertical; double allowed |
| ≥ 1024 px (desktop) | min(88vw, 1200 px) | right rail + top bar | single (user default from prefs wins) |
| Landscape phone | as portrait, taller viewport | bottom bar | vertical |

Rules:
- No horizontal page overflow at any supported width (320 px minimum supported).
- Page aspect preserved; vertical mode fits column width (height auto); paged modes fit the viewport box (letterboxed with neutral background).
- Chrome is always available (visible or via `M`/menu) — never the only navigation path (NFR-A11Y-002).
- Max content width caps readability on large displays (centered, §13).

## 3. Vertical Mode (FR-READER-001)

- Pages render as a **continuous top-to-bottom column** (LTR) — or **bottom-to-top column, i.e., the last page at the top**, for RTL (see §4).
- Position is `(page, scrollOffset)` where `scrollOffset ∈ [0,1)` is the fraction of *that page's height* scrolled past (0 = page top at viewport top… precise definition: offset of page top relative to scroll container top, normalized by page rendered height; clamped 0..1).
- Free scrolling with **soft snap** (bias to nearest page boundary when scroll velocity ~ 0); no hard snap (reduced-motion users get pure free scroll).
- DOM contains **only window-interior pages** (T-READER-019/031); out-of-window slots are placeholder elements with reserved dimensions (zero CLS).
- Progress write cadence: on page boundary cross (immediate) + 1 s debounce of vertical position (FR-READER-014).
- Scroll restoration: on open, scroll to `(savedPage, savedOffset)` before images paint (T-READER-029).

## 4. Direction Semantics (FR-READER-004/005)

Direction determines **reading order**, not just visual mirroring. The single source of truth is `ReaderState.readingDirection`; every behavior derives from it:

| Aspect | LTR | RTL |
|---|---|---|
| Logical page 1 | first page (lowest page_number) | last page (highest page_number) |
| "Next" advances to | page_number + 1 | page_number − 1 |
| Vertical column order (top→bottom) | pages 1,2,3… | pages M, M−1, M−2… |
| Paged navigation: Left key | previous | **next** |
| Paged navigation: Right key | next | **previous** |
| Swipe: right-swipe (finger moves right) | previous | **next** |
| Swipe: left-swipe | next | **previous** |
| Tap zones (LTR: left=center…): left/center/right | prev / menu / next | **next** / menu / **prev** |
| Double-page spread pairing | (1,2),(3,4)… | (M,M−1),(M−2,M−3)… |
- The `dir` attribute on the reader container is set from the effective direction (a11y + layout correctness).
- "Logical page" in the UI position indicator is **the reading-order position**: page 1 is always "where reading starts". Internally, state stores `pageNumber` (physical, 1-based, DATA_MODEL) + direction; the indicator computes `displayIndex = direction === 'rtl' ? M − pageNumber + 1 : pageNumber`. This two-representation rule is the #1 source of reader bugs — the reducer centralizes it (T-READER-003).

## 5. Single-Page Mode (FR-READER-002)

- One page per view, centered in the viewport box.
- Navigation: keyboard (§9), tap zones (§7), swipe (§7), chrome prev/next.
- Transition: instant (reduced-motion) or 120 ms cross-fade (motion allowed); in-flight transition is **cancellable** by an opposite input (swipe cancel semantics §7; keyboard input during transition completes the current step then applies the new one, queue depth 1).
- First/last page: navigation is a no-op (no wrap, T-READER-033); the completion card appears at the end (§13).
- Page indicator: "Page {displayIndex} of M" (§14).

## 6. Double-Page Mode (FR-READER-003)

- Spreads are pairs in reading order: LTR (1,2),(3,4)…; RTL (M,M−1),(M−2,M−3)… (unit-tested pairing, T-READER-006).
- Position state remains the **logical single page** (odd page = left page of LTR spread / right page of RTL spread); the spread is derived (T-READER-006 invariant: spread(page) is pure).
- Odd page count: the final spread is a **single page** (centered, full box width for that page).
- Availability: double is offered when viewport ≥ 640 px; below, it auto-degrades to single (T-READER-013 rule) with a one-time inline notice.
- Switching into/out of double preserves the logical page (T-READER-030 transition table).

## 7. Input: Tap Zones & Swipe (FR-READER-007/008)

### 7.1 Tap zones
- The page area is divided into thirds (RTL mirrors the LTR mapping, §4).
- Center zone: toggles chrome (paged modes) or a small scroll nudge (±10% viewport, vertical mode).
- Long-press (≥ 300 ms) is **not** a tap (prevents accidental nav while the user steadies their hand); multi-touch (pinch) is never a tap.
- Zones are **input enhancement only**: every zone action has a focusable button equivalent (NFR-A11Y-002/006) — the keyboard/SR path never depends on zones.

### 7.2 Swipe (paged modes)
- Commit threshold: ≥ 25% of the page box width, or velocity > 0.5 box-widths/s at release.
- Below threshold at release: **cancel** — the page animates back (or snaps back instantly under reduced motion); no state change.
- Vertical drags in paged modes do nothing (no page scroll in single/double); in vertical mode, swipes are not used (scroll is the input).
- Concurrency: at most one swipe in flight; a new gesture during flight cancels the current animation and begins fresh (queue depth 1).
- Edge pages: swipe at the reading-start page → "start reached" feedback (no-op); at the reading-end page → completion card (as in §13).

## 8. Zoom & Fullscreen (FR-READER-009/010)

### 8.1 Zoom
- Range 100–400%; default from ReaderPreference.zoomDefault (100%).
- Inputs: pinch (touch, 100–400 continuous), Ctrl+wheel (desktop, 10% steps), double-tap (toggle 100% ↔ 200% at tap point), keys `+`/`−` (10% steps) and `0` (reset), chrome zoom controls (100/150/200/300/400 quick set).
- At zoom > 100%, the page pans within the box (two-finger pan / drag); pan is clamped to page bounds.
- Zoom resets on: entering a new chapter, switching to/from double (documented rule, T-READER-030).
- Zoom never changes the *logical page* (it's a transform, not a position) — progress writes are unaffected by zoom.

### 8.2 Fullscreen
- `F` key or chrome button requests fullscreen on the **reader container** (chrome stays inside).
- `Esc` exits (browser standard) — the `fullscreenchange` listener syncs state (user-initiated exits handled).
- Unsupported (iOS Safari): pseudo-fullscreen = chrome hidden + viewport height expanded (documented equivalent).
- Reduced-motion: no transition animation on enter/exit.

## 9. Keyboard Map (FR-READER-006, NFR-A11Y-002)

Initial focus: the reader container on route entry (NFR-A11Y-003). All keys work in both directions (mapping per §4).

| Key | Vertical | Single / Double |
|---|---|---|
| `↓` / `PageDown` / `Space` | scroll down one viewport | next page |
| `↑` / `PageUp` / `Shift+Space` | scroll up one viewport | previous page |
| `Home` / `End` | jump to first / last page | first / last page |
| `←` / `→` | (LTR) ← prev, → next · (RTL) ← next, → prev | as vertical (direction-aware) |
| `+` / `−` | zoom in / out (10%) | same |
| `0` | zoom reset | same |
| `F` | fullscreen toggle | same |
| `M` | cycle mode vertical→single→double→vertical | same |
| `D` | toggle direction override (effective dir) | same |
| `B` | toggle chrome | same |
| `Esc` | exit fullscreen / close dialog / hide chrome (in that priority) | same |

Rules:
- `Space` in paged modes `preventDefault`s (no page scroll behind).
- Browser zoom shortcuts (Ctrl `+`/`−`/`0`) are **not** hijacked (documented exception; the bare keys are the zoom controls).
- While a dialog (mode picker, bookmark note) has focus: reader keys are inert (dialog keys apply); focus trap active (NFR-A11Y-003).
- Every key also has a visible button (chrome) — the map is not the only path.

## 10. Conceptual State (the ReaderState contract)

```ts
/**
 * The reader's single source of truth.
 * Skeleton: src/shared/contracts/reader.ts (types) + features/reader/reader-state.ts (reducer).
 * Invariants (enforced by the reducer, T-READER-003):
 *  - 1 <= currentPage <= totalPages
 *  - loadedWindow.start/end within [1..totalPages], end-start+1 <= 12 (NFR-PERF-011)
 *  - zoom in [1.0, 4.0]
 *  - progressStatus in { 'anonymous-local', 'synced', 'sync-pending', 'sync-failed' }
 */
interface ReaderState {
  chapterId: string;
  mangaSlug: string;
  totalPages: number;
  currentPage: number;          // physical page number (1-based)
  scrollOffset: number;         // 0..1, vertical mode only (0 in paged)
  readingMode: 'vertical' | 'single' | 'double';
  readingDirection: 'rtl' | 'ltr';   // effective (manga default ⊕ user override)
  zoom: number;                 // 1.0..4.0
  fullscreen: boolean;
  chromeVisible: boolean;
  loadedWindow: ReaderWindow;   // { start, end } — the bounded page window (NFR-PERF-011)
  progressStatus: 'anonymous-local' | 'synced' | 'sync-pending' | 'sync-failed';
  completed: boolean;           // chapter completion (FR-READER-017)
  prevChapter?: { slug: string; number: number; title: string | null };  // for FR-READER-016
  nextChapter?: { slug: string; number: number; title: string | null };
}
```

- The state is **serializable** (debug, future restore, tests).
- All transitions go through the reducer; components dispatch, never mutate (T-READER-003).
- `loadedWindow` is derived from `currentPage` + `readingMode` by `calculateReaderWindow` (T-READER-031) — the reducer stores the result; it is never free-form.

## 11. Mode & Direction Transition Table (T-READER-030, spec)

| From → To | Logical page | Scroll offset | Zoom | Window | Notes |
|---|---|---|---|---|---|
| vertical → single | preserved (page of the current scroll position) | reset 0 | preserved | recompute | |
| single → vertical | preserved | 0 | preserved | recompute | |
| single ↔ double | preserved | reset 0 | **reset 1.0** (rule) | recompute (spread-based) | |
| direction flip (any mode) | preserved (physical) | preserved (vertical) / 0 (paged) | preserved | recompute | displayIndex recomputes automatically (§4) |
| any → any | clamped to [1..M] after recompute | — | — | — | 1-page chapter: mode forced to single (documented) |

- Switching is idempotent and commutative over two switches (A→B→A = identity) — property-tested.
- Rapid switches (≤ 300 ms) coalesce to the final target (no intermediate window churn).

## 12. Progress Persistence (FR-READER-012/013/014)

- **Local-first:** every position change updates the device-local store immediately (works offline; anonymous = this only).
- **Server sync (authenticated):**
  - paged modes: on each committed page change (immediate POST).
  - vertical: on page boundary cross (immediate) + 1 s debounce for mid-page offset.
  - on `visibilitychange` (hidden) and `beforeunload`: flush pending (best-effort; `navigator.sendBeacon`-class fallback for the last write — documented).
  - server rejects (422/404): `progressStatus = 'sync-failed'`, local copy retained, one visible inline notice (not per-write spam), retry on next change.
- **Restore priority on open (T-READER-029):**
  1. Deep link `?page=N` is validated/clamped (T-READER-032) — used when **no** saved position exists.
  2. Saved position (server if authenticated, else local) **wins over** the deep link (user intent rule; EC-RDR-12). Bookmark jumps (T-LIB-008) are the documented exception: explicit jump ⇒ deep-link wins (intent was the specific page).
  3. Saved page > current pageCount (chapter re-ingested shorter): clamp to last page + one notice (EC-RDR-10).
- **Anonymous → sign-in (FR-READER-013):** one merge call (per chapter, latest-wins by client timestamp, server-stamped thereafter, UNIT-PROG-003). Confirmation announced (live region).
- **Multi-tab:** independent local stores; server LWW (NFR-DATA-003) resolves; no cross-tab messaging in v1 (documented; each tab sees its own position until reload — acceptable, documented in edge-cases EC-RDR-09).

## 13. Completion, Chapter End & Next Chapter (FR-READER-016/017/024)

- **Completion detection:** last page visible ≥ 1 s (any mode) or explicit "Mark as read" (chapter list) → `completed = true` (sticky; unset only via explicit unmark, T-LIB-006).
- **End-of-chapter state** (reaching the reading-end page):
  - completion card renders: state-dependent CTA:
    - next chapter exists (published) → "Next: Chapter N — title" (FR-READER-016).
    - no next (series end) → "You've finished {title}".
    - next exists but draft/unpublished → "That's everything for now".
  - vertical: card is the flow tail (in scroll, no dead end); paged: card replaces the "next" affordance (next = no-op with card visible).
  - **Auto-advance** (ReaderPreference.autoNextChapter, default true): after 1.5 s on the card, navigate to the next chapter (visible countdown, cancelable by any input). Reduced-motion: no animation, same timing.
- **No wrap-around, ever** (T-READER-033): End at M stays M; there is no "back to start" key (that's Home's job — but Home in a *completed* chapter goes to the reading-start page, which is allowed: Home is position, next is progression).
- **Next-chapter navigation** preserves mode/direction/zoom-reset (new chapter = zoom reset rule §8.1); page starts at reading-start (1) or the saved position if the user had read it before (restore rule §12 applies).

## 14. Failed Images (FR-READER-018, NFR-OBS-007)

- Per-image failure (network error, decode error, HTTP 4xx/5xx) → placeholder: page number + "Failed to load" + **Retry** button (a11y-labeled) + one automatic retry after 500 ms.
- The rest of the chapter stays fully usable (independent per-image state).
- Retry: re-request with `?r=n` cache-bust (n ≤ 2; after 2 failures, the Retry button remains for manual action — no infinite loops).
- ≥ 3 distinct failed pages in one session → banner: "Images may be temporarily unavailable" (with dismiss); no retry storm (banner suppresses auto-retries).
- Permanent 404 on the *active* key after a re-ingest (mid-session, EC-UP-05): the reader refreshes the page list once (new keys), then re-resolves the current page (clamped if the chapter shrank); second failure → unavailable state (T-READER-028).
- Telemetry: each failure emits a beacon event (type=page_load_error, cause, httpStatus); metric `yomi_reader_page_load_errors_total` (NFR-OBS-007).
- All-pages-failing (storage outage): banner + per-page placeholders; reading position still tracks (progress writes continue — they don't depend on images).

## 15. Preloading, Unloading & Offline Transitions (NFR-PERF-011/015, ADR-007)

- **Preload window** (`calculateReaderWindow`, T-READER-031): vertical ±3 (≤ 7 slots), single −1/+2, double ±1 spread; hard cap 12 pages; clamped to [1..M]; O(1).
- **Loading:** pages inside the window load at network priority (active page `high`, rest `low`); in-flight ≤ window + 2; out-of-window in-flight requests are **cancelled** (fetch abort) on window shift (rapid-navigation safety).
- **Unloading (eviction, T-READER-019):** pages leave decoded residency at 2× the window distance (hysteresis band = no flicker on back-scroll); DOM slots persist (reserved dimensions); hard residency cap 12 decoded images (excess dropped farthest-first).
- **Tab hidden:** non-urgent loads pause; the active page still loads (resume is instant on return, no storm — T-READER-020).
- **Slow connections (NFR-PERF-015):** the priority ladder degrades — only the active page + 1 ahead at `high`; on 3G-equivalent: first page ≤ 10 s, subsequent pages progressive, no full-page spinner > 10 s (T-PERF-006 criteria).
- **Offline (navigator.onLine = false):** reading continues from what's loaded/disk-cached; a global banner "Offline — some images may not load"; progress writes queue in the local store (they never required network for the *position*); on reconnect, pending syncs flush (FR-READER-014). **No offline content download** (NO-6) — the banner is honest.
- **Large chapters:** 50/100/200/500 pages behave identically at the memory level by construction (window is position-relative) — the 500-page matrix (PERFORMANCE.md §3) is the acceptance proof.

## 16. Reader Preferences (FR-READER-021)

Stored (authenticated: server; anonymous: device-local — duality documented §12):

| Setting | Values | Default | Effect |
|---|---|---|---|
| defaultMode | vertical / single / double | vertical | applied on chapter open (user can switch per-session) |
| directionOverride | none / rtl / ltr | none (use manga's) | effective direction = override ⊕ manga (§4) |
| zoomDefault | 1.0–4.0 | 1.0 | applied on open (chapter switch resets to it, §8.1) |
| autoNextChapter | true / false | true | §13 auto-advance |

- Changes in the reader are persisted (debounced 500 ms) and take effect immediately (mode/direction) or on next open (defaults).
- The settings UI (`/settings` → reader section) is a form (a11y per ACCESSIBILITY.md §5); the reader chrome also exposes quick mode/direction toggles (same persistence path).
- Preferences never leak between users (server-stored, scoped; device-local is namespaced per browser profile).

## 17. State Diagrams (conceptual)

**Reader page lifecycle:** `opening → ready → reading → (completed → end-card → next-chapter) | unavailable`
**Per-image lifecycle:** `pending → loading → loaded | failed → (retrying → loaded | failed-final)`
**Job of the reducer:** keep the invariants of §10 true across every event; the window/eviction/progress subsystems *observe* state transitions (they do not mutate state directly — they request via events).

## 18. Edge Case Cross-References

The reader's edge-case register lives in docs/product/edge-cases.md (EC-RDR-01…EC-RDR-12): single-page chapters, deleted chapters, re-ingest shrink/grow, multi-tab, deep-link validation, last/first page, offline, reduced motion, 1-page double-page, odd spreads, saved-position vs deep-link conflict, anonymous merge. Each EC has a task owner (TASKS.md).
