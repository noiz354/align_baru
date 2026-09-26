/**
 * Conceptual reader types; no runtime reading behavior.
 * Requirements: FR-READER-001..014, NFR-PERF-013/014. ADR-007.
 * Related tasks: T-READER-001, T-READER-031. See docs/product/reader-behavior.md.
 */
export type ReadingMode = "vertical" | "single" | "double";
export type ReadingDirection = "rtl" | "ltr";

/** Bounded conceptual active page interval; zero-based internal indexes require explicit API conversion. */
export interface ReaderWindow { start: number; end: number; }

export interface ReaderState {
  chapterId: string;
  currentPage: number;
  totalPages: number;
  readingMode: ReadingMode;
  readingDirection: ReadingDirection;
  zoom: number;
  fullscreen: boolean;
  loadedWindow: ReaderWindow;
  progressStatus: "idle" | "pending" | "saved" | "failed" | "offline";
}
