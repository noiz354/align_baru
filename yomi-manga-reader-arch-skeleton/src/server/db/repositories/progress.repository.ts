/**
 * server/db/repositories/progress.repository — BOTH ports over
 * `reading_progress`: the `ResumePositionReader` (T-CATALOG-009, the read side)
 * and the `ReaderProgressRepository` (T-READER-021/022/023, the write side).
 *
 * Two exports, one table. `createProgressPositionReader` is byte-for-byte what
 * T-CATALOG-009 landed; `createReaderProgressRepository` is added below it, so
 * `reading_progress` ends up in ONE reviewed file rather than two
 * half-implementations of one table. That is what SQ-A below asked for, and
 * this change is the lane that discharges it.
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
 * ══════════════════════════════════════════════════════════════════════════
 * WRITE SIDE — `createReaderProgressRepository` (T-READER-021/022/023)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Requirements: FR-READER-012/013/014 (restore, anonymous merge, save),
 * FR-LIBRARY-004 (`last_read_desc` has a key to sort by), FR-LIBRARY-007
 * (`completed` is sticky), NFR-DATA-003 (server-stamped LWW, idempotent
 * upsert), NFR-DATA-006 (timestamptz → ISO-8601 UTC), NFR-SEC-015
 * (parameterised by construction), NFR-OBS-006 (no value in a message),
 * NFR-PERF-004/014 (one read per call, every hot query names its index).
 * Tasks: T-READER-021 (save, idempotent upsert), T-READER-022 (restore),
 * T-READER-023 (the merge endpoint's repository half), T-READER-024 (the
 * anonymous local set this merge consumes), T-LIB-002 (the sort key this file
 * finally maintains — see SQ-LIB-1 in `library.repository.ts`).
 * Tests: INT-PROG-001/002 (`tests/integration/progress.test.ts` — LWW
 * concurrency, sticky `completed`, the `last_read_at` denormalisation),
 * UNIT-PROG-001/002/003. Ports: `features/progress/reader-progress.repository.ts`
 * (its invariants are binding).
 *
 * ── LWW IS A `WHERE` ON THE CONFLICT CLAUSE, NOT A READ-THEN-WRITE ─────────
 * The port calls the save "an idempotent upsert: repeated identical updates
 * change nothing (rowcount 0)" and "an update is applied only when
 * serverNow >= stored.updated_at". Both are ONE statement:
 *
 *   INSERT … VALUES (…, now())
 *   ON CONFLICT (user_id, chapter_id) DO UPDATE
 *      SET page_number = $n, scroll_position = $n,
 *          completed   = reading_progress.completed OR excluded.completed,
 *          updated_at  = now()
 *      WHERE reading_progress.updated_at <= <basis>     ← LWW
 *        AND (reading_progress.page_number     IS DISTINCT FROM $n
 *          OR reading_progress.scroll_position IS DISTINCT FROM $n
 *          OR reading_progress.completed
 *             IS DISTINCT FROM
 *               (reading_progress.completed OR $n))   ← "something changed"
 *   RETURNING updated_at
 *
 * A caller-side SELECT-then-UPDATE would be a TOCTOU: two tabs racing on one
 * chapter (the port's own edge case) would both read the same old row and both
 * write. The `WHERE` is evaluated against the row PostgreSQL has already locked
 * for the conflict, so the loser of the race applies nothing and `RETURNING`
 * hands back nothing — which is how this module tells "applied" from "the guard
 * said no" without a second round trip.
 *
 * The "something changed" clause is what makes an identical repeat a real
 * rowcount 0 instead of a fresh `updated_at`: without it, `now()` would differ
 * on every repeat, every repeat would look like a change, and
 * `reading_progress.updated_at` would track the number of debounced writes
 * rather than the reader's actual position. It also keeps
 * `library_entry.last_read_at` still (see below) instead of letting an
 * unchanged position push a title up the shelf.
 *
 * ── `completed` IS STICKY IN THE `SET`, NOT IN A PRE-CHECK (FR-LIBRARY-007) ─
 * `SET completed = reading_progress.completed OR excluded.completed` — the
 * existing value OR'd with the incoming one. A write can therefore only ever
 * move the flag false → true; a page write carrying `completed: false` leaves a
 * completed chapter completed, which is the port's rule and the reason the
 * explicit unmark op (T-LIB-006, the chapter list) is a SEPARATE statement. A
 * pre-check ("read it, decide, then write") would race two tabs into unsetting
 * a completion, and the OR makes the rule a property of the row.
 *
 * ── THE LWW BASIS IS THE ONLY DIFFERENCE BETWEEN THE TWO WRITE PATHS ───────
 * `saveProgress` compares against `now()` — the server clock, the only value
 * NFR-DATA-003 trusts. `mergeProgress` compares against the entry's own
 * `clientUpdatedAt`, because FR-READER-013 defines an anonymous merge as
 * "per chapter, latest timestamp wins" and the device that read the chapter is
 * the only party that knows when. In BOTH cases the value that LANDS is
 * `now()`: `excluded.updated_at` is a comparison operand, never a stored one.
 * See SQ-RDR-1 for the tension this leaves with THREAT T-18.
 *
 * ── `library_entry.last_read_at` IS MAINTAINED HERE, IN THE SAME TRANSACTION ─
 * `library_entry.last_read_at` is a denormalisation of the reader's most recent
 * `reading_progress` row for that manga, and the schema comment on the column
 * plus DATA_MODEL §11 name the PROGRESS service as its single writer
 * (data-flow.md §5). Before this change nothing wrote it: the column was only
 * ever READ, so the library page's default sort `last_read_desc`
 * (API_CONTRACT §2.4) ordered every entry by NULL — the sort was inert, and
 * `ix_library_user_lastread` had nothing to index. This file is that writer.
 *
 * It is an `UPDATE`, never an upsert: a reader with no entry for the manga gets
 * no row, because the column denormalises an EXISTING membership and reading a
 * chapter is not consent to join a shelf (FR-LIBRARY-001 makes adding an entry
 * its own operation, and T-LIB-001 owns it). A second statement that could
 * half-fail is exactly the failure data-flow.md §5's single-writer chain exists
 * to prevent, so the write rides in the SAME `db.transaction` as the progress
 * row — and is skipped entirely when the progress row's guard rejected the
 * write, because then `updated_at` did not move and neither must the shelf's.
 *
 * ── TRANSACTIONS (data-flow.md §7.3) ───────────────────────────────────────
 * `db.transaction(async (tx) => …)`, the convention `chapter.repository.ts` and
 * `library.repository.ts` already use. Only the multi-table writes use it: a
 * `saveProgress` is two tables (progress + library), a `mergeProgress` is the
 * same two across a whole payload. `getProgress` and `getCompletedSet` touch
 * one table and are plain reads, per §7.3's "single-row writes are plain
 * upserts".
 *
 * ── MERGE VALIDATES IN ONE READ, THEN WRITES PER CHAPTER ───────────────────
 * Three phases, so the classification is a pure function of data already in
 * hand: (1) drop unparseable/non-integer entries and keep the latest
 * `clientUpdatedAt` per chapter; (2) ONE `SELECT chapter.id, page_count,
 * manga_id` for every survivor, so "unknown chapter" and "page out of range"
 * (T-READER-023) are answered without an N+1; (3) one upsert per surviving
 * chapter inside the transaction, then one `last_read_at` UPDATE per DISTINCT
 * manga it touched.
 *
 * Why not one multi-row `INSERT … VALUES (…),(…)`: PostgreSQL's
 * `ON CONFLICT DO UPDATE` may only reference the target table and the `EXCLUDED`
 * pseudo-table in its `SET`/`WHERE`, so a per-row client timestamp cannot be the
 * comparison operand of a batched upsert — and the only column that could carry
 * it (`updated_at`) is the one that must hold the SERVER stamp. A batched form
 * would have to compare against the server clock, which is the save path's rule,
 * not the merge path's. The cost is bounded and rate-limited: the payload is
 * capped at 200 entries (API_CONTRACT §2.3) and the endpoint at 10/account/hour.
 *
 * ── WHICH INDEX SERVES WHICH QUERY (the T-PERF-004 gate list) ───────────────
 * | query                                    | index                                    |
 * |-----------------------------------------|------------------------------------------|
 * | `getProgress()`                          | `reading_progress` PK `(user_id, chapter_id)` |
 * | `saveProgress()` upsert                  | the same PK (the conflict target)        |
 * | `getCompletedSet()`                      | the same PK; `chapter_id IN (…)` is a range scan on its second column |
 * | `mergeProgress()` chapter resolution     | `chapter` PK `id`; `chapter_id IN (…)`   |
 * | `last_read_at` maintenance               | `library_entry` PK `(user_id, manga_id)` |
 * | `last_read_desc` (the consumer)          | `ix_library_user_lastread (user_id, last_read_at)` |
 * No new index is proposed: every access path here is already covered, and the
 * one index that was previously unmaintained is now maintained.
 *
 * ── SPEC-QUESTIONS (AGENTS.md §6) ─────────────────────────────────────────
 * SQ-A (filename reservation) — DISCHARGED by this change. `./index.ts` (the
 *   planner's inventory, which another lane owns) reserved
 *   `progress.repository.ts` for the `ReaderProgressRepository` of
 *   T-READER-021/022 — the write side (`saveProgress`, `getProgress`,
 *   `mergeProgress`, `getCompletedSet`) and the LWW/sticky-`completed` upsert
 *   rules of DATA_MODEL §12. That task is VS-2. This file had claimed the
 *   reserved FILENAME for the read side of the same table and left the write
 *   side for its owner to ADD here, so `reading_progress` would end up in one
 *   reviewed file instead of two half-implementations of one table. That is
 *   what happened: `createReaderProgressRepository` is below, the reader was not
 *   moved, and the reservation is now filled. `./index.ts` still names this file
 *   under `ResumePositionReader` only, and the orchestrator of this lane owns
 *   adding the second factory and dropping `progress` from
 *   `PLANNED_REPOSITORIES`.
 * SQ-B (dependency direction) — the headline question T-CATALOG-009 was told
 *   to raise, recorded in full in `features/progress/resume.service.ts`: the
 *   declared edge "Depends on: … T-READER-022 (get progress)" points backwards
 *   (T-READER-022 is VS-2/VS-3, this task is VS-1) and is not a real
 *   prerequisite, because `reading_progress` already exists from VS-0
 *   (T-FOUND-005) and T-READER-022's own goal names T-CATALOG-009 as its
 *   CONSUMER. The roadmap is not reordered here; the edge should be dropped (or
 *   both tasks moved) by the roadmap owner in a spec-fix task.
 * SQ-RDR-1 (the merge trusts a client clock, T-18 says it must not). The port
 *   and FR-READER-013 both define the anonymous merge as "per chapter, latest
 *   timestamp wins (client timestamp as the merge input, then server-stamped)",
 *   and the port header's own gloss is "client timestamps are never trusted
 *   (merge input only)". Those agree that the client stamp is a comparison
 *   OPERAND, and this file implements exactly that: `excluded.updated_at` never
 *   lands, the stored value is always `now()`. THREAT T-18, however, lists
 *   "future-stamps to win LWW" as the attack this boundary must defeat, which a
 *   client-supplied operand still permits — a device claiming a year from now
 *   would beat every genuine position for that chapter. Impact is bounded to
 *   the caller's own reading data (T-18 scores it "I — user's own data only"),
 *   the endpoint is 10/account/hour and authenticated (NFR-SEC-004 origin
 *   check), and the value stored is still the server's. The alternative — clamp
 *   the operand to the server clock — would break the "latest device wins" rule
 *   the merge exists for, so it is not done unilaterally; the threat-model owner
 *   should state whether merge is in T-18's scope.
 * SQ-RDR-2 (`applied` vs `dropped` are not defined anywhere). API_CONTRACT §2.3
 *   specifies the summary `{ applied, dropped }` but not what either counts.
 *   This file counts an entry as `dropped` when it did not become the stored
 *   position for any reason — the port's two named cases (unknown chapter, page
 *   out of range), an unparseable timestamp, a non-integer page, a duplicate
 *   chapter superseded inside the same payload, and a survivor out-ranked by a
 *   position the server already held. `applied` is therefore the exact
 *   complement, and `applied + dropped === entries.length` always holds, so the
 *   client-side confirmation can account for the whole payload. A reader would
 *   read that as "3 of 12 positions saved", which is the honest sentence.
 * SQ-RDR-3 (`last_read_at` under two concurrent chapters of one manga). This
 *   file sets the column to the `updated_at` of the progress row just written,
 *   which is the rule data-flow.md §5 states. Two writes for two chapters of
 *   the same manga that commit in the opposite order to their stamps would leave
 *   the older stamp on the shelf. `now()` is the transaction timestamp, so the
 *   window is only reachable across two concurrent transactions, and the
 *   consequence is one title ordered one slot low in `last_read_desc` for one
 *   page load. A `greatest(stored, incoming)` would close it, but it would also
 *   make the column disagree with the `lastRead` payload, which
 *   `library.repository.ts` reads from `reading_progress` directly (SQ-LIB-1
 *   there). Left literal here; the roadmap owner decides.
 * SQ-RDR-4 (the merge does not apply the chapter visibility rule). A merge entry
 *   for a soft-deleted or unpublished chapter is accepted if the row exists and
 *   the page is in range, because the port names "unknown chapter" as the only
 *   chapter-side drop condition and `saveProgress` — the primary write path —
 *   applies no visibility filter either, so applying one here would make the two
 *   write paths disagree. T-CATALOG-009's resume reader already refuses to
 *   resume INTO such a chapter, and the row cascades on a hard delete. The
 *   residual is a small, authenticated, rate-limited oracle on a draft
 *   chapter's page count via the `dropped` count (T-READER-023's summary), which
 *   is recorded rather than silently closed.
 */
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { chapter, libraryEntry, readingProgress } from '../schema';
import type { Db } from '../client';
import type { ReaderProgressRepository, SaveReaderProgressInput } from '../../../features/progress';
import type {
  ResumeChapterFact,
  ResumePositionReader,
  ResumeSnapshot,
} from '../../../features/progress/resume.service';
import type { ReaderProgress } from '../../../shared/contracts';
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

/* ══════════════════════════════════════════════════════════════════════════
 * WRITE SIDE — `ReaderProgressRepository` (T-READER-021/022/023)
 * ══════════════════════════════════════════════════════════════════════════ */

/** The slice of a Drizzle handle the write helpers need; a `transaction` satisfies it. */
type Executor = Pick<Db, 'select' | 'insert' | 'update'>;

/**
 * The server's own clock, written as the COLUMN DEFAULT's expression
 * (`updatedAt()` is `DEFAULT now()`), so a value this module stamps and a value
 * the schema defaults are the same kind of timestamp (NFR-DATA-003/006).
 *
 * `now()` is the TRANSACTION timestamp in PostgreSQL, not the wall clock per
 * statement. That is the mechanism behind two rules this file relies on: every
 * progress row written inside one `mergeProgress` transaction carries the SAME
 * stamp (so grouping the denormalisation per manga is exact), and the progress
 * row's stamp and the `last_read_at` copied from it are the same value by
 * construction rather than by a second `now()` that could tick between them.
 */
const STAMP = sql`now()`;

/** One `reading_progress` row, as this module projects and writes it. */
interface ProgressRow {
  chapterId: string;
  pageNumber: number;
  scrollPosition: number;
  completed: boolean;
  updatedAt: Date;
}

/** The `chapter` facts the merge needs for ONE id: does it exist, how long is it. */
interface ChapterShape {
  pageCount: number;
  mangaId: MangaId;
}

/** What one merge entry contributes, after shape validation and per-chapter dedup. */
interface MergeCandidate {
  chapterId: ChapterId;
  pageNumber: number;
  completed: boolean;
  /** Normalised ISO-8601, bound as a `timestamptz` comparison operand. */
  clientStamp: string;
  /** Epoch ms of the same instant — the ordering key for "latest wins". */
  at: number;
}

/** Row → DTO (data-flow.md §7): Drizzle row types stop in this file. */
function toReaderProgress(row: ProgressRow): ReaderProgress {
  return {
    chapterId: row.chapterId as ChapterId,
    pageNumber: row.pageNumber,
    scrollPosition: row.scrollPosition,
    completed: row.completed,
    // timestamptz → ISO-8601 UTC (NFR-DATA-006).
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The columns every `reading_progress` read in this file projects. */
const PROGRESS_COLUMNS = {
  chapterId: readingProgress.chapterId,
  pageNumber: readingProgress.pageNumber,
  scrollPosition: readingProgress.scrollPosition,
  completed: readingProgress.completed,
  updatedAt: readingProgress.updatedAt,
} as const;

/**
 * The LWW predicate: apply only when the stored stamp is not newer than the
 * basis (NFR-DATA-003).
 *
 * `clientStamp === null` is the SAVE path, where the basis is the server clock —
 * a client value must never decide this (THREAT T-18, and the port's "client
 * timestamps are never trusted (merge input only)"). The MERGE path passes the
 * entry's own stamp instead, because FR-READER-013 defines the merge as latest
 * -wins on the device that read the chapter; see SQ-RDR-1.
 *
 * The `::timestamptz` cast is on the bound parameter, so the client string is
 * compared as a timestamp and never as text (an unparseable one is rejected in
 * TypeScript before it reaches here). This mirrors `library.repository.ts`'s
 * cursor predicates.
 */
function lwwGuard(clientStamp: string | null): SQL {
  return clientStamp === null
    ? lte(readingProgress.updatedAt, STAMP)
    : lte(readingProgress.updatedAt, sql`${clientStamp}::timestamptz`);
}

/**
 * ONE statement for both write paths: the idempotent `reading_progress` upsert.
 *
 * @param clientStamp the LWW basis operand, or `null` for the server clock
 *   (see {@link lwwGuard}).
 *
 * @returns the row's NEW `updated_at`, or `null` when the guard rejected the
 *   write. A rejected write is not an error and not a rowcount the caller has to
 *   count: `RETURNING` on an `ON CONFLICT DO UPDATE` whose `WHERE` matched no
 *   row returns nothing, which is the whole of "applied vs not" for both paths.
 */
async function upsertProgress(
  tx: Executor,
  row: {
    userId: UserId;
    chapterId: ChapterId;
    pageNumber: number;
    scrollPosition: number;
    completed: boolean;
  },
  clientStamp: string | null,
): Promise<Date | null> {
  // "Identical repeat changes nothing (rowcount 0)": without this clause a
  // repeat would differ only in `now()`, so it would look like a change, bump
  // the stamp, and shove the title up the shelf. `is distinct from` rather than
  // `<>` so the comparison is NULL-safe, and the completion term is written as
  // "the value the SET would store" (`completed OR excluded.completed`, i.e. the
  // sticky rule above) — which is the only completion transition a write can
  // cause, false → true.
  const wouldChange = sql`(
      ${readingProgress.pageNumber} is distinct from ${row.pageNumber}
      or ${readingProgress.scrollPosition} is distinct from ${row.scrollPosition}
      or ${readingProgress.completed}
         is distinct from (${readingProgress.completed} or ${row.completed})
    )`;
  // `and` is typed `SQL | undefined` because an ALL-empty argument list is
  // meaningless; both of these are always present, so the assertion is a fact
  // the type cannot see — the same `as SQL` that `manga.repository.ts`'s
  // `chapterVisibleWhere` uses for the same reason. `exactOptionalPropertyTypes`
  // forbids handing `onConflictDoUpdate` the `undefined` arm.
  const guard = and(lwwGuard(clientStamp), wouldChange) as SQL;

  const applied = await tx
    .insert(readingProgress)
    .values({
      userId: row.userId,
      chapterId: row.chapterId,
      pageNumber: row.pageNumber,
      scrollPosition: row.scrollPosition,
      completed: row.completed,
      // Server-stamped even on the INSERT path, where a client value would
      // otherwise be the only thing in the row (THREAT T-18).
      updatedAt: STAMP,
    })
    .onConflictDoUpdate({
      // The `reading_progress` PRIMARY KEY (user_id, chapter_id) — the conflict
      // target IS the lookup key, so no pre-read is needed.
      target: [readingProgress.userId, readingProgress.chapterId],
      set: {
        pageNumber: row.pageNumber,
        scrollPosition: row.scrollPosition,
        // FR-LIBRARY-007, sticky: the existing value OR'd with the incoming one,
        // so a page write can only ever move it false → true. `excluded` is
        // PostgreSQL's pseudo-table for the proposed row; it is an IDENTIFIER in
        // a fixed template, never a runtime value, so NFR-SEC-015 holds.
        completed: sql`${readingProgress.completed} or excluded.completed`,
        updatedAt: STAMP,
      },
      where: guard,
    })
    .returning({ updatedAt: readingProgress.updatedAt });
  return applied[0]?.updatedAt ?? null;
}

/**
 * Sets `library_entry.last_read_at` for ONE manga — the denormalisation the
 * library's default sort orders by (data-flow.md §5, FR-LIBRARY-004, SQ-RDR-3).
 *
 * An `UPDATE`, never an upsert: a reader with no entry for this manga gets no
 * row. The column denormalises an EXISTING membership, and reading a chapter is
 * not consent to join a shelf — `LibraryRepository.add` is that operation
 * (FR-LIBRARY-001) and this file never calls it.
 */
async function touchLibraryLastRead(
  tx: Executor,
  userId: UserId,
  mangaId: MangaId,
  at: Date,
): Promise<void> {
  await tx
    .update(libraryEntry)
    .set({ lastReadAt: at })
    .where(
      and(
        // The caller's own shelf (THREAT T-04); another reader's entry is not
        // reachable through this predicate.
        eq(libraryEntry.userId, userId),
        eq(libraryEntry.mangaId, mangaId),
      ),
    );
}

/**
 * The same denormalisation for the single-row save path, resolving the chapter's
 * manga INSIDE the `WHERE` so it stays one statement.
 *
 * A correlated scalar subquery rather than a second `SELECT`: the chapter's
 * manga is the key of the row being updated, and if the chapter does not exist
 * the subquery is NULL, `manga_id = NULL` is never true, and zero entries are
 * touched — the "unknown chapter ⇒ touch nothing" case falls out instead of
 * needing a branch. The interpolated id is a bind parameter
 * (`${chapterId}::uuid`), so nothing is concatenated (NFR-SEC-015).
 */
async function touchLibraryLastReadForChapter(
  tx: Executor,
  userId: UserId,
  chapterId: ChapterId,
  at: Date,
): Promise<void> {
  await tx
    .update(libraryEntry)
    .set({ lastReadAt: at })
    .where(
      and(
        eq(libraryEntry.userId, userId),
        eq(
          libraryEntry.mangaId,
          sql`(select ${chapter.mangaId} from ${chapter} where ${chapter.id} = ${chapterId}::uuid)`,
        ),
      ),
    );
}

/**
 * Keeps the latest `clientUpdatedAt` per chapter and rejects entries whose shape
 * cannot be a position (FR-READER-013, T-READER-023, T-READER-024).
 *
 * "Per chapter, latest wins" is applied HERE, over the payload, so a device
 * that flushed the same chapter twice contributes one row rather than two
 * writes whose commit order would then decide the outcome. Whichever entry
 * loses is counted as `dropped` — including the one that was already in the map
 * and is being replaced — because SQ-RDR-2 promises `applied + dropped ===
 * entries.length`, and an entry that is silently overwritten would break it.
 * On an exact stamp tie the FIRST arrival is kept, so a payload of identical
 * stamps has one defined outcome rather than one that depends on the order the
 * device happened to flush them in.
 *
 * A non-integer page is dropped rather than truncated: `page_number` is an
 * integer column with a CHECK, and a fractional page is malformed data, not a
 * position — truncating it would invent a page the reader never saw.
 */
function toMergeCandidates(
  entries: Parameters<ReaderProgressRepository['mergeProgress']>[1],
): { candidates: MergeCandidate[]; dropped: number } {
  const latest = new Map<string, MergeCandidate>();
  let dropped = 0;
  for (const entry of entries) {
    const at = Date.parse(entry.clientUpdatedAt);
    if (!Number.isFinite(at) || !Number.isInteger(entry.pageNumber)) {
      dropped += 1;
      continue;
    }
    const previous = latest.get(entry.chapterId);
    if (previous !== undefined) {
      // Two entries for one chapter: the EARLIER-stamped one is the one that is
      // dropped, whichever side of the comparison it happens to be on, so the
      // outcome never depends on the order the device flushed them in.
      if (previous.at >= at) {
        dropped += 1;
        continue;
      }
      dropped += 1;
    }
    latest.set(entry.chapterId, {
      chapterId: entry.chapterId,
      pageNumber: entry.pageNumber,
      completed: entry.completed === true,
      clientStamp: new Date(at).toISOString(),
      at,
    });
  }
  return { candidates: [...latest.values()], dropped };
}

/**
 * Builds the Drizzle `ReaderProgressRepository` (T-READER-021 save, T-READER-022
 * restore, T-READER-023's merge).
 *
 * Both write methods also maintain `library_entry.last_read_at` in the SAME
 * transaction as the progress row — that column was previously written by
 * nothing, which left the library page's default sort inert. See this file's
 * header for the single-writer chain, the LWW/sticky rules and the merge's
 * `applied`/`dropped` definition.
 *
 * @param db the application pool from `createDb` (DML only, T-SEC-005).
 *   Composed at the root; never constructed at import time.
 */
export function createReaderProgressRepository(db: Db): ReaderProgressRepository {
  return {
    /**
     * Persist the current reader position (T-READER-021, FR-READER-014).
     *
     * The page is NOT re-validated against `chapter.page_count` here: the port
     * states it is "validated against chapter pageCount before reaching here"
     * and the service owns that check, because it is the party that already
     * read the chapter (EC-RDR-10's clamp lives there too). The schema's
     * `reading_progress_page_number` CHECK (`>= 1`) is the last line of defence
     * and it fires, rather than silently storing a bad position.
     */
    async saveProgress(userId: UserId, input: SaveReaderProgressInput): Promise<void> {
      // TWO tables, so ONE transaction (data-flow.md §7.3). A committed progress
      // row with a stale `last_read_at` would be the half-write §5's
      // single-writer chain exists to prevent.
      await db.transaction(async (tx) => {
        const appliedAt = await upsertProgress(
          tx,
          {
            userId,
            chapterId: input.chapterId,
            pageNumber: input.pageNumber,
            scrollPosition: input.scrollPosition,
            completed: input.completed === true,
          },
          // The server clock is the ONLY LWW basis here (NFR-DATA-003, T-18).
          null,
        );
        // Rejected by the guard ⇒ `updated_at` did not move ⇒ neither must the
        // shelf, or an identical repeat would reshuffle `last_read_desc`.
        if (appliedAt === null) return;
        await touchLibraryLastReadForChapter(tx, userId, input.chapterId, appliedAt);
      });
    },

    /**
     * Retrieve the most recent position for a chapter (T-READER-022,
     * FR-READER-012).
     *
     * ONE indexed read of the `reading_progress` PRIMARY KEY — never a count, a
     * join or a fallback — and `null` when the caller has no row, which the port
     * distinguishes from an error (a chapter never opened is a normal state).
     *
     * RAW is returned on purpose: a position past the chapter's current
     * `page_count` (a re-ingest shrank it) is the SERVICE's clamp to make
     * (EC-RDR-10), and a repository that quietly fixed it would report a page
     * the reader was never on.
     */
    async getProgress(userId: UserId, chapterId: ChapterId): Promise<ReaderProgress | null> {
      const rows = await db
        .select({ ...PROGRESS_COLUMNS })
        .from(readingProgress)
        .where(
          and(
            // The caller's own rows only (THREAT T-04/T-18); `userId` came from
            // the session `Caller`, never from a request.
            eq(readingProgress.userId, userId),
            eq(readingProgress.chapterId, chapterId),
          ),
        )
        .limit(1);
      const row = rows[0] as ProgressRow | undefined;
      return row === undefined ? null : toReaderProgress(row);
    },

    /**
     * Apply an anonymous local set on sign-in (FR-READER-013, T-READER-023/024).
     *
     * Validation is one read for the whole payload and the writes are one
     * statement per surviving chapter inside a single transaction, so the
     * `last_read_at` denormalisation cannot survive a failed merge and no
     * chapter's write can be visible without its own. `applied`/`dropped` follow
     * SQ-RDR-2 and always sum to the payload length.
     */
    async mergeProgress(
      userId: UserId,
      entries: Parameters<ReaderProgressRepository['mergeProgress']>[1],
    ): Promise<{ applied: number; dropped: number }> {
      const { candidates, dropped: malformed } = toMergeCandidates(entries);

      // One read resolves every survivor: `id` (does the chapter exist at all),
      // `page_count` (is the page in range) and `manga_id` (whose shelf to
      // touch). A per-candidate lookup would be the N+1 NFR-PERF-004 forbids,
      // against a 200-entry payload.
      const shapes = new Map<string, ChapterShape>();
      if (candidates.length > 0) {
        const rows = await db
          .select({ id: chapter.id, pageCount: chapter.pageCount, mangaId: chapter.mangaId })
          .from(chapter)
          .where(inArray(chapter.id, candidates.map((candidate) => candidate.chapterId)));
        for (const row of rows) {
          shapes.set(row.id, { pageCount: row.pageCount, mangaId: row.mangaId as MangaId });
        }
      }

      return db.transaction(async (tx) => {
        let applied = 0;
        let dropped = malformed;
        // One `last_read_at` UPDATE per DISTINCT manga, not per chapter: every
        // row written in this transaction shares one `now()`, so a single value
        // per manga is exact (and `SET`ting it repeatedly would be pure noise).
        const lastReadByManga = new Map<MangaId, Date>();

        for (const candidate of candidates) {
          const shape = shapes.get(candidate.chapterId);
          // Unknown chapter, or a page the chapter does not have. A draft has
          // `page_count = 0`, so every page is out of range for it — which is
          // also why no visibility filter is applied here (SQ-RDR-4).
          if (
            shape === undefined ||
            candidate.pageNumber < 1 ||
            candidate.pageNumber > shape.pageCount
          ) {
            dropped += 1;
            continue;
          }
          const appliedAt = await upsertProgress(
            tx,
            {
              userId,
              chapterId: candidate.chapterId,
              pageNumber: candidate.pageNumber,
              // The merge entry carries no scroll offset (FR-READER-013 syncs a
              // page); a paged session's offset is 0 by definition.
              scrollPosition: 0,
              completed: candidate.completed,
            },
            // The one place a client value decides an LWW (see SQ-RDR-1); the
            // value that LANDS is still `now()`.
            candidate.clientStamp,
          );
          if (appliedAt === null) {
            // Valid, but the server already holds a newer position for this
            // chapter — the port's "latest wins" resolving against the account
            // rather than against this device.
            dropped += 1;
            continue;
          }
          applied += 1;
          lastReadByManga.set(shape.mangaId, appliedAt);
        }

        for (const [mangaId, at] of lastReadByManga) {
          await touchLibraryLastRead(tx, userId, mangaId, at);
        }

        return { applied, dropped };
      });
    },

    /**
     * The chapters of `chapterIds` this reader has completed (FR-LIBRARY-007's
     * consumer — the library list's read/unread state).
     *
     * ONE query for the whole set, never a lookup per chapter: the library page
     * asks about every chapter it renders. Scoped by `user_id` and by the sticky
     * `completed` flag, so a chapter with a position that was never completed is
     * correctly absent — completion is a decision only the progress write makes
     * (NFR-DATA-003), never a reach-the-last-page guess.
     */
    async getCompletedSet(userId: UserId, chapterIds: ChapterId[]): Promise<Set<ChapterId>> {
      // `in ()` is a syntax error in PostgreSQL, and an empty IN list has no
      // meaning anyway: a caller with no chapters cannot have completed any.
      if (chapterIds.length === 0) return new Set<ChapterId>();
      const rows = await db
        .select({ chapterId: readingProgress.chapterId })
        .from(readingProgress)
        .where(
          and(
            eq(readingProgress.userId, userId),
            eq(readingProgress.completed, true),
            // The port bounds this at 1000 chapters; the predicate is a range
            // scan on the PK's second column either way.
            inArray(readingProgress.chapterId, chapterIds),
          ),
        );
      return new Set(rows.map((row) => row.chapterId as ChapterId));
    },
  };
}
