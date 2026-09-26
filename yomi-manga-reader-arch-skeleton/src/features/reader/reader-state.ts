/**
 * ReaderState store + reducer contract (the reader's single source of truth).
 *
 * Responsibility: ALL reader transitions (page, mode, direction, zoom,
 * fullscreen, window recompute) pass through this reducer; invariants are
 * enforced centrally so no component can desync position/window/zoom.
 *
 * Requirements: FR-READER-001…005/023, NFR-PERF-010/011, ADR-007.
 * Tasks: T-READER-003 (implementation), UNIT-READER-001 (property tests),
 * T-READER-030 (transition table), T-READER-031/032 (window/index deps).
 *
 * Invariants (property-tested — UNIT-READER-001):
 * - 1 <= state.currentPage <= state.totalPages after every transition
 * - state.loadedWindow === calculateReaderWindow(currentPage, totalPages, mode)
 * - 1.0 <= zoom <= 4.0
 * - transitions are pure (no I/O, deterministic; same input ⇒ same output)
 * - switch A→B→A is identity over position (T-READER-030 table)
 *
 * Edge cases the reducer must handle:
 * - 1-page chapter (mode forced single; next/prev no-ops)
 * - direction flip (displayIndex derivation, reader-behavior.md §4)
 * - mode switch at the boundary pages (clamp after recompute)
 * - rapid inputs (queue depth 1; coalesce switches ≤ 300 ms)
 * - invalid deep-link input (clamped via validatePageIndex, T-READER-032)
 *
 * The client store (Zustand-class, PLANNED dependency or a minimal custom
 * store — decided at T-READER-003) wraps this pure reducer; the reducer
 * itself is isomorphic and unit-tested without a DOM.
 */
import type { ReaderState } from '../../shared/contracts';

/** Events the reducer accepts (the complete list — exhaustive switch). */
export type ReaderEvent =
  | { type: 'goto-page'; page: number } // clamped by T-READER-032 rules
  | { type: 'next-page' }
  | { type: 'prev-page' }
  | { type: 'first-page' }
  | { type: 'last-page' }
  | { type: 'set-scroll'; offset: number } // vertical: 0..1
  | { type: 'set-mode'; mode: ReaderState['readingMode'] }
  | { type: 'set-direction'; direction: ReaderState['readingDirection'] }
  | { type: 'set-zoom'; zoom: number } // clamped 1.0..4.0
  | { type: 'reset-zoom' }
  | { type: 'toggle-fullscreen' }
  | { type: 'toggle-chrome' }
  | { type: 'mark-completed' } // sticky (FR-READER-017)
  | { type: 'window-recompute' }; // after any mode/page change (O(1))

/**
 * The pure reducer.
 *
 * TODO(T-READER-003): implement against the reader-behavior.md §11
 * transition table. No side effects: window/eviction/progress subsystems
 * OBSERVE resulting state (they never mutate it directly).
 *
 * Invariants to assert internally (debug builds + unit fuzz):
 * - index bounds (T-READER-032), window cap (T-READER-031), zoom bounds.
 */
export function reduceReaderState(state: ReaderState, event: ReaderEvent): ReaderState {
  throw new Error('Not implemented: T-READER-003 (reader reducer)');
}

/**
 * Initial state from a chapter-open context (SSR shell data + restore
 * result). The restore priority (deep link vs saved vs bookmark jump) is
 * resolved by T-READER-029 BEFORE this constructor runs.
 *
 * TODO(T-READER-001/029): implement the constructor (pure).
 */
export function createReaderState(input: {
  chapterId: string;
  mangaSlug: string;
  totalPages: number;
  readingDirection: 'rtl' | 'ltr';
  defaultMode: ReaderState['readingMode'];
  zoomDefault: number;
  restored?: { pageNumber: number; scrollOffset: number } | null;
  prevChapter: ReaderState['prevChapter'];
  nextChapter: ReaderState['nextChapter'];
}): ReaderState {
  throw new Error('Not implemented: T-READER-001 (initial reader state)');
}
