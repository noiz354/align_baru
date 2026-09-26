/**
 * Bounded preload window — THE reader memory boundary (ADR-007).
 *
 * Computes which pages SHOULD eventually be kept near the active page so
 * that hundreds of high-resolution images are never active simultaneously
 * (NFR-PERF-011; reader-behavior.md §15; PERFORMANCE.md §3).
 *
 * Requirements: NFR-PERF-011/010/012, FR-READER-019/020.
 * Task: T-READER-031 (implementation), UNIT-READER-004/005 (tests — the
 * canonical tests for this ADR).
 *
 * Contract (normative):
 * - mode-aware sizes: vertical ±3 (≤ 7 slots) · single −1/+2 ·
 *   double ±1 spread (≤ 6 pages)
 * - clamped to [1..totalPages]
 * - HARD CAP: the window never exceeds 12 pages in any mode (defensive
 *   invariant; guards 500-page chapters and future mode additions)
 * - O(1), pure, no allocation-heavy paths
 * - recompute is idempotent (same inputs ⇒ same window); rapid navigation
 *   sequences must never violate invariants (fuzz: 1k random walks,
 *   UNIT-READER-005)
 *
 * Edge cases (all must pass):
 * - first page (start clamps to 1)
 * - last page (end clamps to M)
 * - chapters smaller than the window (full range, no error)
 * - M = 1 (window {1,1})
 * - 500-page chapter at page 1 / 250 / 500 (identical slot counts)
 *
 * NO algorithm in the architecture phase — the contract above is the spec.
 */
import type { ReaderWindow, ReadingMode } from '../../shared/contracts';

/**
 * TODO(T-READER-031): implement per the contract in the header.
 *
 * DO NOT implement during the architecture phase.
 */
export function calculateReaderWindow(
  currentPage: number,
  totalPages: number,
  mode: ReadingMode,
): ReaderWindow {
  throw new Error('Not implemented: T-READER-031');
}
