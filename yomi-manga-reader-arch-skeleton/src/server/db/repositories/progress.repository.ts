/**
 * server/db/repositories/progress.repository — the `ResumePositionReader`
 * port implementation (T-CATALOG-009).
 *
 * Responsibility: the ONE query behind continue-reading resolution — a caller's
 * own `reading_progress` rows joined to the manga's readable chapters, in
 * reading order. Everything after that is the pure decision in
 * `features/progress/resume.service.ts`; nothing here decides anything.
 *
 * Requirements: FR-CATALOG-008 (continue-reading entry at the saved page),
 * FR-LIBRARY-005 (home continue-reading list resolver), FR-READER-012,
 * NFR-PERF-004 (one read, no N+1), NFR-PERF-014 (every hot query is indexed),
 * NFR-DATA-002 (soft delete is a filter, never a join-away), NFR-SEC-015
 * (parameterized by construction).
 * Task: T-CATALOG-009 (this file), T-CATALOG-002 (composition-root wiring —
 * it calls `createProgressPositionReader` and hands the result to
 * `createResumeService`). Tests: INT-PROG-001 reuse
 * (`tests/integration/progress.resume.test.ts`); the rules are UNIT-PROG-004
 * in `tests/unit/progress.resume.test.ts`.
 * Docs: DATA_MODEL §9 (chapter), §11 (library_entry), §12 (reading_progress),
 * docs/product/reader-behavior.md §12–13, TASKS.md T-CATALOG-009.
 *
 * ── Why the row filter is the load-bearing part of this file ───────────────
 * The port contract says a snapshot contains VALID chapters only. Each clause
 * below is a rule, not an optimization:
 *   `c.deleted_at is null`  a SOFT-deleted chapter KEEPS its progress row
 *                           (the FK cascades only on a hard delete), so
 *                           without this the reader would be resumed into a
 *                           chapter that no longer exists — the task's
 *                           "progress on a deleted chapter" edge case.
 *   `c.status = 'published'`  an unpublished chapter is 404-shaped for a
 *                           reader (FR-CHAPTER-002, API_CONTRACT §1); a
 *                           continue-reading entry must never point at one.
 *   `c.page_count >= 1`     a chapter with no committed pages renders
 *                           "unavailable" (T-READER-028), so it cannot be a
 *                           resume TARGET — and it guarantees the EC-RDR-10
 *                           clamp in the service has a non-empty range.
 *   the LEFT JOIN on `(chapter_id, user_id)`  every chapter of the manga comes
 *                           back, with the reader's row where one exists,
 *                           because "the next unread chapter" is a chapter
 *                           WITHOUT a row (rule 2). An inner join could not
 *                           answer that question, and splitting it into two
 *                           round trips would be the N+1 NFR-PERF-004 forbids.
 *
 * ── Indexes (NFR-PERF-014, T-PERF-004) ────────────────────────────────────
 *   chapters:   two candidates, and which one the planner picks is a cost
 *               decision — `ix_chapters_manga_order (manga_id, reading_order)`
 *               covers the manga_id equality AND the ORDER BY, while the partial
 *               `ix_chapters_visible (reading_order) WHERE deleted_at IS NULL
 *               AND status = 'published'` is much smaller and already implies
 *               two of the three WHERE clauses. On the INT-PROG-001 fixture the
 *               planner picks `ix_chapters_visible` and filters `manga_id` and
 *               `page_count`; on a real catalogue `ix_chapters_manga_order` is
 *               the natural path. INT-PROG-001 asserts the plan (an index scan
 *               on `chapter`, never a sequential scan) rather than trusting
 *               this comment.
 *   progress:   the `reading_progress` PRIMARY KEY `(user_id, chapter_id)` —
 *               `user_id` leads, so the LEFT JOIN is one index lookup per
 *               chapter. Verified in the same plan.
 * No new index is proposed: every access path here is already covered.
 *
 * ── Rules this module obeys ────────────────────────────────────────────────
 * - Parameterized only. Drizzle's query builder emits bind parameters; there is
 *   no `sql.unsafe`, no `sql.raw`, and no concatenated SQL (NFR-SEC-015).
 * - Drizzle row types never leave this module (client.ts; data-flow.md §7):
 *   `chapter.number` is `numeric(8,2)` and arrives as a STRING, and it is
 *   converted here, once, on purpose (ADR-003 R2).
 * - D1 inverted: this file imports the feature's port TYPE and no feature
 *   logic. The decision lives in the feature, so it is testable without a
 *   database and cannot drift from the rules the feature documents.
 *
 * ── SPEC-QUESTIONS (AGENTS.md §6) ─────────────────────────────────────────
 * SQ-A (filename reservation). `./index.ts` (the planner's inventory, which
 *   another lane owns) reserves `progress.repository.ts` for the
 *   `ReaderProgressRepository` of T-READER-021/022 — the write side
 *   (`saveProgress`, `getProgress`, `mergeProgress`, `getCompletedSet`) and the
 *   LWW/sticky-`completed` upsert rules of DATA_MODEL §12. That task is VS-2
 *   and has NOT run. This file therefore claims the reserved FILENAME for the
 *   read side of the same table and leaves the write side for its owner to
 *   ADD here, so `reading_progress` ends up in one reviewed file instead of two
 *   half-implementations of one table. Whoever executes T-READER-021/022 must
 *   extend this file, not create a competing one, and must not move this
 *   reader out of it.
 * SQ-B (dependency direction) — the headline question T-CATALOG-009 was told
 *   to raise, recorded in full in `features/progress/resume.service.ts`: the
 *   declared edge "Depends on: … T-READER-022 (get progress)" points backwards
 *   (T-READER-022 is VS-2/VS-3, this task is VS-1) and is not a real
 *   prerequisite, because `reading_progress` already exists from VS-0
 *   (T-FOUND-005) and T-READER-022's own goal names T-CATALOG-009 as its
 *   CONSUMER. The roadmap is not reordered here; the edge should be dropped (or
 *   both tasks moved) by the roadmap owner in a spec-fix task.
 */
import { and, asc, eq, gte, isNull } from 'drizzle-orm';
import { chapter, readingProgress } from '../schema';
import type { Db } from '../client';
import type {
  ResumeChapterFact,
  ResumePositionReader,
  ResumeSnapshot,
} from '../../../features/progress/resume.service';
import type { ChapterId, MangaId, UserId } from '../../../shared/types';

/** One row of the join: a chapter of the manga + the caller's row for it. */
interface ResumeRow {
  chapterId: string;
  chapterNumber: string;
  readingOrder: number;
  pageCount: number;
  pageNumber: number | null;
  scrollPosition: number | null;
  completed: boolean | null;
}

/**
 * `numeric(8,2)` → `number` (ADR-003 R2: the column reads back as a string and
 * is converted deliberately, once, here).
 *
 * The column is `NOT NULL` and constrained to a numeric type, so this cannot
 * fail in practice; the guard exists so a corrupted row degrades to a sortable
 * `0` instead of poisoning a position with `NaN` (a NaN chapter number would
 * survive into the UI and into the home list's sort).
 */
function toChapterNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Row → feature fact (data-flow.md §7; Drizzle row types stay in this file). */
function toChapterFact(row: ResumeRow): ResumeChapterFact {
  return {
    chapterId: row.chapterId as ChapterId,
    chapterNumber: toChapterNumber(row.chapterNumber),
    readingOrder: row.readingOrder,
    pageCount: row.pageCount,
    // `completed` is NOT NULL on a real row, so a present page number is what
    // decides whether there IS a position (never `completed` alone).
    position:
      row.pageNumber === null
        ? null
        : {
            pageNumber: row.pageNumber,
            scrollPosition: row.scrollPosition ?? 0,
            completed: row.completed ?? false,
          },
  };
}

/**
 * Builds the `ResumePositionReader` over a live Drizzle handle.
 *
 * @param db the application pool from `createDb` (DML only, T-SEC-005).
 *   Composed at the root; never constructed at import time.
 *
 * Returns `null` (never throws) when the manga has no readable chapter — a
 * hidden, deleted or wholly unpublished manga, which is 404-shaped null in the
 * catalog (API_CONTRACT §1), not an error.
 */
export function createProgressPositionReader(db: Db): ResumePositionReader {
  return {
    async readResumeSnapshot(userId: UserId, mangaId: MangaId): Promise<ResumeSnapshot | null> {
      const rows = await db
        .select({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          readingOrder: chapter.readingOrder,
          pageCount: chapter.pageCount,
          pageNumber: readingProgress.pageNumber,
          scrollPosition: readingProgress.scrollPosition,
          completed: readingProgress.completed,
        })
        .from(chapter)
        .leftJoin(
          readingProgress,
          and(
            eq(readingProgress.chapterId, chapter.id),
            // The caller's own rows only. `userId` came from the session
            // `Caller` (THREAT T-04); there is no other user in this query.
            eq(readingProgress.userId, userId),
          ),
        )
        .where(
          and(
            eq(chapter.mangaId, mangaId),
            isNull(chapter.deletedAt),
            eq(chapter.status, 'published'),
            gte(chapter.pageCount, 1),
          ),
        )
        // Reading order (FR-CHAPTER-004); see the index note in this file's header.
        .orderBy(asc(chapter.readingOrder));

      if (rows.length === 0) return null;
      return { mangaId, chapters: rows.map((row) => toChapterFact(row)) };
    },
  };
}
