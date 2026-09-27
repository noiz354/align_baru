/**
 * Core reader domain logic and pure navigation mathematics.
 * Requirements: FR-READER-001..009; ADR-007; docs/product/reader-behavior.md.
 */
import type { ReadingDirection, ReadingMode } from "../../shared/types/reader";

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Maps physical 1-based pageNumber to logical reading-order index (displayIndex).
 * In RTL, reading starts at the highest physical page (totalPages) and progresses to 1.
 * In LTR, reading starts at 1 and progresses to totalPages.
 * Preserves the invariant: rtl displayIndex + ltr displayIndex = totalPages + 1.
 */
export function displayIndex(pageNumber: number, totalPages: number, direction: ReadingDirection): number {
  const p = clamp(pageNumber, 1, totalPages);
  return direction === "rtl" ? totalPages - p + 1 : p;
}

/**
 * Step page in reading order direction.
 * In LTR: forward (+1) increments page number; back (-1) decrements.
 * In RTL: forward (+1) decrements page number; back (-1) increments.
 */
export function stepPage(currentPage: number, step: 1 | -1, totalPages: number, direction: ReadingDirection): number {
  const delta = direction === "rtl" ? -step : step;
  return clamp(currentPage + delta, 1, totalPages);
}

/**
 * Double-page spread pairing (UNIT-READER-006, UNIT-READER-007, EC-RDR-01, EC-RDR-03).
 * Returns array of 1 or 2 physical page numbers for the spread.
 * In LTR: [left, right] e.g. [1, 2], [3, 4] ...
 * In RTL: [right, left] e.g. [240, 239], [238, 237] ...
 * Handles odd page counts with a single-page final spread.
 */
export function spreadFor(pageNumber: number, totalPages: number, direction: ReadingDirection): number[] {
  const p = clamp(pageNumber, 1, totalPages);

  if (totalPages === 1) {
    return [1];
  }

  if (direction === "ltr") {
    const isOdd = p % 2 === 1;
    const start = isOdd ? p : p - 1;
    if (start === totalPages) {
      return [start];
    }
    return [start, start + 1];
  } else {
    // RTL: Pages pair down from totalPages towards 1
    // (M, M-1), (M-2, M-3) ...
    const offsetFromEnd = totalPages - p;
    const pairStartOffset = Math.floor(offsetFromEnd / 2) * 2;
    const firstInSpread = totalPages - pairStartOffset;
    const secondInSpread = firstInSpread - 1;

    if (secondInSpread < 1) {
      return [firstInSpread];
    }
    return [firstInSpread, secondInSpread];
  }
}
