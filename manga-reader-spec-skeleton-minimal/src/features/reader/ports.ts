/** Reader contracts only. Requirements FR-READER-001..014; ADR-007; T-READER-001/031. */
import type { ChapterManifest } from "../chapters/contracts";
import type { ReaderWindow } from "../../shared/types/reader";
export interface ChapterManifestReader { getManifest(chapterId: string): Promise<ChapterManifest>; }
export interface ReaderWindowInput { currentPage: number; totalPages: number; }
/**
 * Defines where active pages may eventually be retained, not an algorithm.
 * Invariants: bounded, valid chapter range; see PERFORMANCE.md.
 * Edge cases: first/last, rapid navigation, mode switch, fewer pages than window.
 * TODO(T-READER-031): implement only in authorized reader performance slice.
 */
export function calculateReaderWindow(_input: ReaderWindowInput): ReaderWindow {
  throw new Error("Not implemented: T-READER-031");
}
