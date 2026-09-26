/**
 * ReaderProgressRepository
 *
 * Responsibility:
 * Stores and retrieves the user's latest reading position.
 *
 * Requirements:
 * - FR-READER-014
 * - FR-LIBRARY-006
 *
 * Related tasks:
 * - T-READER-021
 * - T-READER-022
 *
 * Implementation constraints:
 * - Infrastructure implementation belongs under server/db.
 * - Feature layer must depend on this abstraction rather than
 *   directly accessing the database (rule D1).
 *
 * Semantics (NFR-DATA-003, THREAT T-18 — normative):
 * - save is an IDEMPOTENT upsert: repeated identical updates change
 *   nothing (rowcount 0).
 * - Last-write-wins by SERVER-stamped `updated_at`: an update is applied
 *   only when serverNow >= stored.updated_at; client timestamps are never
 *   trusted (merge input only, FR-READER-013).
 * - `completed` is STICKY on this path: a page write can set it true
 *   (completion detection) but cannot unset it (explicit unmark is the
 *   read-status op, T-LIB-006).
 * - The acting user is always the session user (THREAT T-04) — no
 *   userId parameter exists on this port on purpose.
 */
import type { ReaderProgress } from '../../shared/contracts';
import type { ChapterId, UserId } from '../../shared/types';

export interface SaveReaderProgressInput {
  chapterId: ChapterId;
  /** 1-based; validated against chapter pageCount before reaching here. */
  pageNumber: number;
  /** 0..1 (vertical offset); 0 for paged writes. */
  scrollPosition: number;
  /** Sticky (see semantics). */
  completed?: boolean;
}

export interface ReaderProgressRepository {
  /**
   * Persist the current reader position.
   *
   * TODO(T-READER-021):
   * Define persistence behavior according to DATA_MODEL.md §12
   * (upsert on (user_id, chapter_id); server timestamp; sticky completed;
   * idempotent). Also update the library denormalized `last_read_at`
   * (single-writer chain, T-LIB-002).
   */
  saveProgress(userId: UserId, input: SaveReaderProgressInput): Promise<void>;

  /**
   * Retrieve the most recent position for a chapter.
   *
   * TODO(T-READER-022):
   * Implement after the database repository ADR (ADR-003) is executed at
   * T-FOUND-005/006. Single indexed read (PK); null when none.
   * Edge case: stored page > current pageCount (re-ingest shrank the
   * chapter) — the SERVICE clamps (EC-RDR-10); the repository returns raw.
   */
  getProgress(
    userId: UserId,
    chapterId: ChapterId,
  ): Promise<ReaderProgress | null>;

  /**
   * Merge (FR-READER-013, T-READER-023): apply an anonymous local set on
   * sign-in — per chapter, latest wins (client timestamp as the merge
   * input, then server-stamped). Invalid entries (unknown chapter, page
   * out of range) are dropped, counted, not fatal.
   *
   * TODO(T-READER-023).
   */
  mergeProgress(
    userId: UserId,
    entries: Array<{ chapterId: ChapterId; pageNumber: number; completed?: boolean; clientUpdatedAt: string }>,
  ): Promise<{ applied: number; dropped: number }>;

  /** Bulk read for the library list (completed set per user, ≤ 1000 chapters). */
  getCompletedSet(userId: UserId, chapterIds: ChapterId[]): Promise<Set<ChapterId>>;
}
