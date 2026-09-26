/**
 * HistoryReader/HistoryRepository — reading history (append sessions).
 *
 * Responsibility: contiguous read-session recording (FR-READER-015) and
 * the history list (FR-LIBRARY-008).
 *
 * Requirements: FR-READER-015, FR-LIBRARY-008, NFR-DATA-005.
 * Tasks: T-READER-025 (implementation), INT-PROG-002.
 *
 * Session semantics (DATA_MODEL §13, normative):
 * - one row per CONTIGUOUS session per chapter: opened → closed on
 *   completion, 5-min tab-hidden, or unload; re-entry within 5 min
 *   EXTENDS the row (deepest page updated, ended_at pushed).
 * - anonymous: no history (privacy-by-default, documented).
 * - chapter FK is SET NULL on chapter deletion (rows retained, rendered
 *   "Unavailable chapter" — DATA_MODEL §13/§14).
 * - timestamps server-stamped (EC-XX-01).
 */
import type { HistoryEntry } from '../../shared/contracts';
import type { ChapterId, UserId } from '../../shared/types';

export interface ProgressReader {
  /** Resume data for catalog/detail (T-CATALOG-009 consumer). */
  latestForManga(userId: UserId, mangaId: string): Promise<{
    chapterId: ChapterId;
    chapterNumber: number;
    pageNumber: number;
    scrollOffset: number;
  } | null>;
}

export interface HistoryRepository {
  /** Start-or-extend the current session (idempotent per 5-min window). */
  openSession(userId: UserId, input: {
    chapterId: ChapterId;
    pageNumber: number;
  }): Promise<void>;

  /** Update deepest page (called on page changes; cheap upsert). */
  touchDeepest(userId: UserId, chapterId: ChapterId, pageNumber: number): Promise<void>;

  /** Close the session (completion / hidden / unload). */
  closeSession(userId: UserId, chapterId: ChapterId): Promise<void>;

  /** History list (newest first, cursor). */
  list(userId: UserId, query: { cursor?: string; limit?: number }): Promise<{
    items: HistoryEntry[];
    nextCursor: string | null;
  }>;
}
