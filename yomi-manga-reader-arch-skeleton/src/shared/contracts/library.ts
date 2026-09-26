/**
 * Library / history / bookmark contracts.
 *
 * Authority: DATA_MODEL.md §11–14, API_CONTRACT.md §2.4.
 * Requirements: FR-LIBRARY-001…010, FR-READER-015.
 * Tasks: T-LIB-001…009.
 *
 * Rule: every shape here is scoped to the CALLING user (the server resolves
 * the caller from the session — THREAT T-04); no `userId` appears in these
 * DTOs, and never in any client-supplied input.
 */
import type { MangaSummary } from './manga';

/** Library entry row (FR-LIBRARY-003). */
export interface LibraryEntry {
  manga: MangaSummary;
  addedAt: string;
  lastRead: {
    chapterNumber: number;
    pageNumber: number;
    at: string; // ISO-8601 UTC
  } | null;
  /** Published chapters − completed (computed server-side, one query). */
  unreadChapterCount: number;
  /** True when the manga is unpublished/deleted (private entry retained). */
  unavailable: boolean;
}

export type LibrarySort = 'last_read_desc' | 'added_desc' | 'title_asc';

/** History row (FR-LIBRARY-008). `chapter: null` = deleted chapter, retained row. */
export interface HistoryEntry {
  chapter: {
    id: string;
    number: number;
    mangaSlug: string;
    mangaTitle: string;
  } | null;
  deepestPage: number;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

/** Bookmark (FR-LIBRARY-009/010). `pageNumber: null` = chapter start. */
export interface Bookmark {
  id: string;
  chapter: {
    id: string;
    number: number;
    mangaSlug: string;
    mangaTitle: string;
  } | null; // deleted chapter ⇒ null (row retained, jump disabled)
  pageNumber: number | null;
  /** Plain text, ≤ 280 chars (NFR-SEC-016). */
  note: string;
  createdAt: string;
}
