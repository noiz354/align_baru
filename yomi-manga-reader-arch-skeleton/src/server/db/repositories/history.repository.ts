/**
 * server/db/repositories — `HistoryRepository` (T-READER-025).
 *
 * The reading-history adapter: contiguous read sessions over `reading_history`
 * (DATA_MODEL §13) and the history list behind `/history` (FR-LIBRARY-008).
 *
 * Requirements: FR-READER-015, FR-LIBRARY-008, NFR-DATA-005 (a deleted chapter
 * keeps its row), NFR-DATA-006 (timestamptz → ISO-8601 UTC), NFR-SEC-015.
 * Task: T-READER-025 (implementation), T-LIB-005 (the list consumer).
 *
 * Rules this file implements, and why they are not optional:
 *
 * - **One row per contiguous session per chapter** (DATA_MODEL §13). Re-entry
 *   within the 5-minute window EXTENDS the open row — deepest page moves,
 *   `ended_at` is pushed — rather than opening a second row. The constant is named
 *   `SESSION_GAP_MS` and is the task's 5-minute rule, not a tuning knob.
 * - **Deepest page, not last page.** A reader who jumps back must not lower the
 *   recorded depth, so `touchDeepest` writes `greatest(existing, incoming)`.
 * - **Anonymous writes nothing.** `openSession` refuses a null caller upstream in
 *   the service; here the user id is the only scoping key, so privacy-by-default is
 *   a property of the service, and the port says so.
 * - **`chapter_id` is `ON DELETE SET NULL`** (DATA_MODEL §13). The history row is
 *   retained and renders `chapter: null`; the list therefore LEFT JOINs, and never
 *   filters those rows away.
 *
 * Tasks T-PERF-004: the list is ordered by `(user_id, started_at DESC)` which
 * `ix_history_user_time` serves; the session lookups seek `(user_id, chapter_id)`
 * on that same index.
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { AppError } from '../../../shared/contracts/errors';
import type { HistoryRepository } from '../../../features/progress/history.repository';
import type { ChapterId, UserId } from '../../../shared/types';
import type { Db } from '../client';
import { chapter, manga, readingHistory } from '../schema';

/** DATA_MODEL §13: re-entry inside this window extends the open session. */
const SESSION_GAP_MS = 5 * 60 * 1000;

/** Columns the history list projects, with both resolution joins. */
const HISTORY_COLUMNS = {
  id: readingHistory.id,
  chapterId: readingHistory.chapterId,
  deepestPage: readingHistory.pageNumber,
  startedAt: readingHistory.startedAt,
  endedAt: readingHistory.endedAt,
  durationMs: readingHistory.durationMs,
  chapterNumber: chapter.number,
  mangaSlug: manga.slug,
  mangaTitle: manga.title,
};

interface HistoryRow {
  id: string;
  chapterId: string | null;
  deepestPage: number;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  chapterNumber: string | null;
  mangaSlug: string | null;
  mangaTitle: string | null;
}

export const HISTORY_DEFAULT_LIMIT = 24;
export const HISTORY_MAX_LIMIT = 48;

/**
 * Decodes a cursor, or throws `CATALOG_PAGE_INVALID` (422) — the same code the
 * catalog and library use for a cursor they will not repair. Repaired pagination
 * silently returns the wrong page, which is worse than a refusal.
 */
function decodeHistoryCursor(cursor: string): { k: string; i: string } {
  const invalid = (): never => {
    throw new AppError('CATALOG_PAGE_INVALID');
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return invalid();
  }
  if (typeof parsed !== 'object' || parsed === null) return invalid();
  const candidate = parsed as { v?: unknown; k?: unknown; i?: unknown };
  if (candidate.v !== 1) return invalid();
  if (typeof candidate.k !== 'string' || typeof candidate.i !== 'string') return invalid();
  if (candidate.k === '' || candidate.i === '') return invalid();
  return { k: candidate.k, i: candidate.i };
}

function encodeHistoryCursor(key: string, id: string): string {
  return Buffer.from(JSON.stringify({ v: 1, k: key, i: id }), 'utf8').toString('base64url');
}

/**
 * Maps one row to the DTO. `chapter: null` is the retained-row case
 * (NFR-DATA-005), not a missing row: the history entry is still the reader's.
 */
function toHistoryEntry(row: HistoryRow): import('../../../shared/contracts').HistoryEntry {
  const chapterId = row.chapterId;
  return {
    chapter:
      chapterId === null
        ? null
        : {
          id: chapterId,
          // `number` is numeric(8,2) in the DB (a string there) and a number in
          // the DTO, so a special chapter "10.5" survives the round trip.
          number: Number(row.chapterNumber ?? 0),
          mangaSlug: row.mangaSlug ?? '',
          mangaTitle: row.mangaTitle ?? '',
        },
    deepestPage: row.deepestPage,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    durationMs: row.durationMs,
  };
}

/**
 * Builds the `HistoryRepository` (T-READER-025, FR-READER-015 / FR-LIBRARY-008).
 *
 * @param db the application's handle from `createDb(env)` (dependency rule D2).
 */
export function createHistoryRepository(db: Db): HistoryRepository {
  /**
   * The still-open session for this (user, chapter), if one is recent enough to
   * extend. A row older than the 5-minute window is a different session and must
   * not be reopened — hence the `started_at` bound in the WHERE rather than a
   * read-then-decide in TypeScript.
   */
    const openSessionWhere = (userId: UserId, chapterId: ChapterId): SQL =>
      sql`(${readingHistory.userId} = ${userId}
         and ${readingHistory.chapterId} = ${chapterId}
         and ${readingHistory.endedAt} is null
         and ${readingHistory.startedAt} > now()
             - (${SESSION_GAP_MS}::int * interval '1 millisecond'))`;

  return {
    async openSession(userId: UserId, input: { chapterId: ChapterId; pageNumber: number }) {
      // A pre-check would race two tabs into two sessions; the insert is the
      // decision. Two statements, one transaction (data-flow.md §7.3).
      await db.transaction(async (tx) => {
        const extended = await tx
          .update(readingHistory)
          .set({
            // Deepest page, never lower: jumping back must not undo the record.
            pageNumber: sql`greatest(${readingHistory.pageNumber}, ${input.pageNumber})`,
            endedAt: null,
          })
          .where(openSessionWhere(userId, input.chapterId))
          .returning({ id: readingHistory.id });
        if (extended.length > 0) return;
        await tx.insert(readingHistory).values({
          userId,
          chapterId: input.chapterId,
          pageNumber: input.pageNumber,
          startedAt: new Date(),
          endedAt: null,
          durationMs: null,
        });
      });
    },

    async touchDeepest(userId: UserId, chapterId: ChapterId, pageNumber: number) {
      await db
        .update(readingHistory)
        .set({ pageNumber: sql`greatest(${readingHistory.pageNumber}, ${pageNumber})` })
        .where(openSessionWhere(userId, chapterId));
    },

    async closeSession(userId: UserId, chapterId: ChapterId) {
      // `durationMs` is derived, not supplied: the span between the server-stamped
      // start and the server-stamped close, so a client clock cannot invent it.
      await db
        .update(readingHistory)
        .set({
          endedAt: new Date(),
          durationMs: sql`greatest(0, (extract(epoch from (now() - ${readingHistory.startedAt})) * 1000)::bigint)::int`,
        })
        .where(openSessionWhere(userId, chapterId));
    },

    async list(userId: UserId, query: { cursor?: string; limit?: number }) {
      const limit = Math.min(Math.max(query.limit ?? HISTORY_DEFAULT_LIMIT, 1), HISTORY_MAX_LIMIT);
      const where: SQL[] = [eq(readingHistory.userId, userId)];
      if (query.cursor !== undefined) {
        const { k, i } = decodeHistoryCursor(query.cursor);
        // Newest first, keyed on `started_at` (NOT NULL, server-stamped) with the
        // row id as the tiebreaker, so the order is total and a cursor is stable.
        // `${i}::uuid`, not `::bigint`: `reading_history.id` is a uuid, and the
        // comparison is what the database type-checks, so a wrong cast made every
        // page after the first answer 500 (`uuid = bigint`). The first page never
        // exercised this branch, which is exactly why it survived review.
        where.push(sql`(${readingHistory.startedAt}, ${readingHistory.id}) < (${k}::timestamptz, ${i}::uuid)`);
      }
      // BOTH joins are LEFT: a deleted chapter keeps its history row and renders
      // `chapter: null` (NFR-DATA-005). An inner join would silently drop it.
      const rows = (await db
        .select(HISTORY_COLUMNS)
        .from(readingHistory)
        .leftJoin(chapter, eq(readingHistory.chapterId, chapter.id))
        .leftJoin(manga, eq(chapter.mangaId, manga.id))
        .where(and(...where))
        .orderBy(desc(readingHistory.startedAt), desc(readingHistory.id))
        // Over-fetch by one: a full page means there may be a successor, and a
        // cursor that fetched an empty page is a cursor that lies.
        .limit(limit + 1)) as unknown as HistoryRow[];

      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map(toHistoryEntry),
        nextCursor:
          rows.length > limit && last !== undefined
            ? encodeHistoryCursor(last.startedAt.toISOString(), String(last.id))
            : null,
      };
    },
  };
}
