/**
 * Reader contracts and core window calculation.
 * Requirements: FR-READER-001..014, NFR-PERF-013/014; ADR-007; T-READER-001/031.
 */
import type { ChapterManifest } from "../chapters/contracts";
import type { ReaderWindow, ReadingMode } from "../../shared/types/reader";

export interface ChapterManifestReader {
  getManifest(chapterId: string): Promise<ChapterManifest>;
}

export interface ReaderWindowInput {
  currentPage: number;
  totalPages: number;
  mode?: ReadingMode;
}

/**
 * Calculates bounded active/preload page interval.
 *
 * Invariants & Contract (ADR-007, PERFORMANCE.md, reader-behavior.md):
 * - mode-aware sizes:
 *   - vertical: current ±3 (up to 7 pages)
 *   - single: -1 / +2 pages
 *   - double: ±1 spread (up to 6 pages)
 * - clamped to [1..totalPages]
 * - HARD CAP: window size never exceeds 12 pages in any mode
 * - O(1), pure, no allocation-heavy paths
 * - Edge cases: first/last page, totalPages < window size, single page chapter (1)
 */
export function calculateReaderWindow(input: ReaderWindowInput): ReaderWindow {
  const { currentPage, totalPages, mode = "single" } = input;

  if (totalPages <= 0) {
    return { start: 1, end: 1 };
  }

  // Clamp current page within valid bounds
  const clampedPage = Math.max(1, Math.min(currentPage, totalPages));

  let start: number;
  let end: number;

  switch (mode) {
    case "vertical":
      start = clampedPage - 3;
      end = clampedPage + 3;
      break;
    case "double":
      start = clampedPage - 2;
      end = clampedPage + 3;
      break;
    case "single":
    default:
      start = clampedPage - 1;
      end = clampedPage + 2;
      break;
  }

  // Clamp bounds
  start = Math.max(1, start);
  end = Math.min(totalPages, end);

  // Enforce hard cap of 12 pages defensively
  if (end - start + 1 > 12) {
    end = start + 11;
  }

  return { start, end };
}
