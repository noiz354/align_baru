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
  getProgress(userId: UserId, chapterId: ChapterId): Promise<ReaderProgress | null>;

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
    entries: Array<{
      chapterId: ChapterId;
      pageNumber: number;
      completed?: boolean;
      clientUpdatedAt: string;
    }>,
  ): Promise<{ applied: number; dropped: number }>;

  /** Bulk read for the library list (completed set per user, ≤ 1000 chapters). */
  getCompletedSet(userId: UserId, chapterIds: ChapterId[]): Promise<Set<ChapterId>>;

  /**
   * Clear `completed` for one chapter — the ONLY unset path (NFR-DATA-003).
   *
   * It exists as its own operation and not as `saveProgress({ completed:
   * false })` because the save path is sticky-OR by contract: `SET completed =
   * reading_progress.completed OR excluded.completed`. A `false` there is
   * structurally incapable of clearing a `true`, so the read-status feature could
   * only either lie about having marked a chapter unread or be wired to a no-op.
   * It did the latter, and said so in a comment (SQ-LIB-7). The sticky-OR stays:
   * it is what stops a stale page write from un-finishing a chapter. Those are
   * two different intents, so they are two different operations.
   *
   * Scope, deliberately narrow:
   * - Clears `completed` ONLY. `pageNumber` and `scrollPosition` are left alone, so
   *   "unread" means "not finished", not "start over" — the resume rules
   *   (`features/progress/resume.service.ts`) will still point at the stored page.
   *   Rewinding the position is a different decision with a different cost (it
   *   discards where the reader was) and is not implied by unmarking a chapter.
   * - A chapter with NO progress row is a no-op, not a throw: "not started" and
   *   "explicitly marked unread" agree, and a reader has no row to clear.
   * - Another user's row is never touched (THREAT T-04): the write is keyed on
   *   `userId`, so there is nothing to get wrong.
   * - Its OWN LWW guard, on the server clock like `saveProgress`. A stale unset
   *   must not un-finish a chapter the reader completed a moment later.
   *
   * Requirements: FR-LIBRARY-006, NFR-DATA-003, THREAT T-04, THREAT T-18.
   * Tasks: T-LIB-006, T-READER-021 (F-008-S1).
   */
  unsetCompleted(userId: UserId, chapterId: ChapterId): Promise<void>;
}
