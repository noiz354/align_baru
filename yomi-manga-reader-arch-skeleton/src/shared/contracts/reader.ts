/**
 * Reader contracts — state, window, progress.
 *
 * Authority: docs/product/reader-behavior.md §10 (state), ADR-007,
 * PERFORMANCE.md §3 (window/residency budgets).
 * Requirements: FR-READER-001…024, NFR-PERF-010/011/012.
 * Tasks: T-READER-003 (store/reducer), T-READER-031 (window),
 * T-READER-021/022 (progress persistence).
 */
import type { ChapterId } from '../types';
// ReadingDirection is canonical in './manga' (a property of the title —
// FR-READER-004/005); imported here so reader state types stay complete.
import type { ReadingDirection } from './manga';

export type ReadingMode = 'vertical' | 'single' | 'double';

/**
 * The conceptual window of chapter pages the future reader keeps active
 * around the current position (ADR-007).
 *
 * This boundary exists to prevent hundreds of high-resolution images from
 * being fetched or decoded simultaneously (NFR-PERF-010/011).
 *
 * Invariants (enforced by `calculateReaderWindow`, T-READER-031):
 * - 1 <= start <= end <= totalPages
 * - end - start + 1 <= 12 (hard cap, all modes)
 * - mode-aware sizes: vertical ±3 · single −1/+2 · double ±1 spread
 * - O(1); pure (no I/O, no allocation-heavy paths)
 *
 * Edge cases the implementation must handle (T-READER-031/032/033):
 * - first page (no under-window)
 * - last page (no over-window)
 * - chapters smaller than the window (full range, no clamping errors)
 * - 500-page chapters (position-relative, identical memory behavior)
 * - rapid navigation (idempotent recompute)
 *
 * No algorithm is implemented during the architecture phase.
 */
export interface ReaderWindow {
  start: number; // 1-based physical page number
  end: number; // inclusive, 1-based
}

/**
 * The reader's single source of truth (reader-behavior.md §10).
 *
 * Invariants (reducer-enforced, T-READER-003):
 * - 1 <= currentPage <= totalPages (FR-READER-023)
 * - loadedWindow consistent with (currentPage, readingMode) via
 *   calculateReaderWindow (never free-form)
 * - zoom in [1.0, 4.0] (FR-READER-009)
 * - state is fully serializable (debug/restore/test)
 *
 * `currentPage` is the PHYSICAL page number (1-based, DATA_MODEL §10).
 * The UI "display index" for RTL is derived (M − currentPage + 1) —
 * reader-behavior.md §4. The reducer is the only place that mapping exists.
 */
export interface ReaderState {
  chapterId: ChapterId;
  mangaSlug: string;
  totalPages: number;
  currentPage: number;
  /** Vertical mode only: 0..1 fraction of the current page scrolled past. 0 in paged modes. */
  scrollOffset: number;
  readingMode: ReadingMode;
  /** Effective direction (manga default ⊕ user override, FR-READER-021). */
  readingDirection: ReadingDirection;
  zoom: number; // 1.0..4.0
  fullscreen: boolean;
  chromeVisible: boolean;
  loadedWindow: ReaderWindow;
  /**
   * Progress persistence status (FR-READER-013/014):
   * - anonymous-local: only the device store is used
   * - synced: last write accepted by the server
   * - sync-pending: write in flight
   * - sync-failed: last write rejected (local copy retained; notice shown)
   */
  progressStatus: 'anonymous-local' | 'synced' | 'sync-pending' | 'sync-failed';
  /** Sticky completion (FR-READER-017; unset only via explicit unmark). */
  completed: boolean;
  /** Neighbor chapters for FR-READER-016 (null when absent/hidden). */
  prevChapter: { slug: string; number: number; title: string | null } | null;
  nextChapter: { slug: string; number: number; title: string | null } | null;
}

/**
 * A persisted reading position (DATA_MODEL §12, API_CONTRACT §2.3).
 * Server-stamped `updatedAt` is the LWW basis (NFR-DATA-003).
 */
export interface ReaderProgress {
  chapterId: ChapterId;
  pageNumber: number; // 1-based
  /** Vertical-mode offset within the page (0..1); 0 for paged sessions. */
  scrollPosition: number;
  completed: boolean;
  updatedAt: string; // ISO-8601 UTC, SERVER time
}

/**
 * Per-user reader preferences (FR-READER-021, DATA_MODEL §15).
 * `directionOverride: 'none'` means "use the manga's direction".
 */
export interface ReaderPreference {
  defaultMode: ReadingMode;
  directionOverride: 'none' | 'rtl' | 'ltr';
  /** 1.0..4.0 */
  zoomDefault: number;
  autoNextChapter: boolean;
}
