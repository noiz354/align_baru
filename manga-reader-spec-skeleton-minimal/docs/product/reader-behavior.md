# Reader behavior specification

## Conceptual state
`ReaderState`: chapterId, currentPage (one-based), totalPages, readingMode (`vertical|single|double`), readingDirection (`rtl|ltr`), zoom (fit/scale), fullscreen, loadedWindow (bounded start/end), progressStatus (`idle|pending|saved|failed|offline`), pageLoadStates by ordinal. This is a contract sketch, not state implementation. Chapter direction metadata is authoritative; user override may be offered only if explicit and persisted as preference.

## Modes and direction
Vertical: continuous vertical sequence, preserve logical order and stable scroll anchor when changing mode. Single: one page at a time; navigation changes ordinal in configured direction semantics while labels report page number. Double: paired pages with a documented cover/first-page rule and RTL/LTR spread order. Do not assume a two-page spread on narrow viewports; fall back to single page and announce why. RTL means progression and spread pairing follow right-to-left reading order; LTR follows left-to-right. Do not mirror artwork. Direction is distinct from UI locale.

## Inputs
Keyboard: configurable previous/next, page/home/end, zoom controls; avoid hijacking browser/system keys; shortcuts do not replace labeled buttons. Mouse: explicit controls, click/tap regions configurable with safe central dead zone; never rely on accidental page click. Touch: swipe navigation and pinch zoom where supported; visible controls remain. Gesture recognition must avoid interfering with vertical scroll, browser back, text selection, or assistive technologies. Keyboard and single-pointer alternatives satisfy WCAG.

## Zoom/fullscreen
Fit-width/fit-height/original or bounded continuous zoom are future policy choices. Preserve focus and page identity across zoom; no content trap or crop by default. Fullscreen requested by user gesture only, reflect state accessibly, exit through Escape/browser controls, restore focus and viewport on exit.

## Loading and memory
Initial visible page prioritized, then bounded near-page window. Preload only a small configurable set; cancel stale requests on rapid navigation/mode changes. Release distant decoded bitmaps/DOM nodes/object URLs when safe. Chapters of 50,100,200,500 pages must not eagerly download/decode all pages. Dimensions/byte limits and concurrency set by T-READER performance qualification. Keep placeholders sized from metadata to avoid layout shift. Failed page offers retry and does not block navigating elsewhere. Expired delivery link may trigger bounded manifest refresh, never expose raw origin.

## Progress and chapter completion
Progress identifies page and chapter, includes version/updated time. Debounce policy, offline queue behavior and conflict resolution remain decisions for T-READER-021: update only authenticated user server state; do not regress newer position silently; multiple tabs resolve deterministically; anonymous progress is not server-persisted without privacy-approved design. Completion threshold policy must be product decision; don't infer from last page seen until decided. Next chapter appears only if published/authorized. At first/last boundaries, disable/announce unavailable navigation rather than wrap silently.

## Network and preferences
Offline transition shows cached/current page availability honestly, does not claim chapter downloaded. Retry is user-controlled with backoff policy and cancellation. Preferences cover reading mode, direction override, fit/zoom, tap zones, keyboard; defaults must support first-use and reduced motion. Preference sync conflict uses schema version, and local browser state must not leak across accounts.

## Edge state transitions
Empty manifest is a content error; one page suppresses meaningless next/previous; missing ordinal is integrity failure; deleted/unpublished chapter is unavailable and progress reconciliation is explicit; page count updates invalidate stale anchors safely. Rapid mode changes preserve current logical page. Screen reader announcements are concise and not emitted on every scroll pixel.
