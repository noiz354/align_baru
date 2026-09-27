/**
 * features/progress — ResumeService: continue-reading resolution
 * (T-CATALOG-009).
 *
 * Responsibility: given a caller and a manga, answer ONE question — "where
 * should this reader resume?" — as `{ chapterId, chapterNumber, pageNumber,
 * scrollOffset }` or `null`. Consumers: the manga detail page and the home
 * "continue reading" list (T-LIB-004, VS-5). Module ownership per
 * docs/architecture/module-boundaries.md §"features/progress": "progress +
 * history domain rules … resume resolution service (shared with catalog)".
 *
 * Requirements: FR-CATALOG-008 (continue-reading entry at the saved page),
 * FR-LIBRARY-005 (home continue-reading list — this service is its resolver),
 * FR-READER-012 (position restored at page + scroll offset), EC-RDR-10 (a
 * saved page beyond the current page count clamps), NFR-DATA-003 (server-
 * stamped LWW progress), NFR-PERF-004/014 (one indexed read, no N+1).
 * Task: T-CATALOG-009. Sibling task: T-READER-022 (`ProgressRepository.get`) —
 * see the spec-question below.
 * Tests: UNIT-PROG-004 (`tests/unit/progress.resume.test.ts`, the rules) and
 * INT-PROG-001 reuse (`tests/integration/progress.resume.test.ts`, the one
 * query that feeds it against a real PostgreSQL).
 * Docs: DATA_MODEL §11/§12, docs/product/reader-behavior.md §12 (restore
 * priority) and §13 (completion → next chapter), TASKS.md T-CATALOG-009.
 *
 * ── The decision is a pure function; the data is a port ──────────────────────
 * `resolveResumePosition` is total and side-effect free, so every rule below is
 * assertable without a database (TEST_STRATEGY §1 unit level) and the SQL is
 * confined to ONE query in the repository
 * (`server/db/repositories/progress.repository.ts`). Boundary: this module
 * imports only `shared/**` (D5) and never `server/**` (D1).
 *
 * ── Rules, in the order they are applied ───────────────────────────────────
 * The snapshot already contains only VALID chapters of the manga — not soft-
 * deleted (NFR-DATA-002), not `draft` (FR-CHAPTER-002: an unpublished chapter
 * is 404-shaped for a reader, and a resume entry must never point at one),
 * and with at least one committed page (a 0-page chapter renders "unavailable",
 * T-READER-028). Those exclusions are the repository's WHERE clause, which is
 * also what implements the deleted-chapter edge case: a soft-deleted chapter
 * keeps its `reading_progress` row (the FK cascades only on a hard delete), so
 * without the filter the reader would be resumed into a chapter that no longer
 * exists.
 *
 *   1. No valid chapter, or none started → `null` (nothing to resume; the
 *      detail page renders its "start reading" affordance).
 *   2. Deepest STARTED chapter — the greatest `reading_order` that has a
 *      progress row. "Started" deliberately INCLUDES completed chapters: a
 *      finished chapter was started, and the task's rule 1 is "deepest
 *      started", not "deepest unfinished". When that chapter is not completed,
 *      its stored page/scroll is the answer (clamped, see EC-RDR-10).
 *   3. The deepest started chapter IS completed → the first chapter AFTER it
 *      that is not completed, at page 1 / offset 0 (it has never been read, so
 *      there is no position to restore). Rule 2 of the task: "completed manga →
 *      next unread chapter (if any) else null".
 *   4. Nothing unread remains → `null`, and the detail page shows the "read"
 *      state (the task's second edge case).
 *
 * ── Why `pageCount >= 1` and the clamp live here ───────────────────────────
 * T-READER-022 fixes the division of labour: "the repository returns raw, the
 * SERVICE clamps (EC-RDR-10)". Re-ingest replaces the page set (FR-UPLOAD-009),
 * so a stored page can exceed the chapter's current page count; and
 * `scroll_position` carries no CHECK in DATA_MODEL §12, so a legacy or
 * hand-edited value can be outside 0..1. Both are normalized to the reader's
 * invariant (`ReaderState`: 1 ≤ currentPage ≤ totalPages, 0 ≤ scrollOffset ≤ 1)
 * rather than pushed onto two different consumers.
 *
 * ── SECURITY: IDOR is structurally impossible (THREAT T-04) ───────────────
 * `resolveResume` takes a `CallerContext` — the frozen identity the route
 * guard attached (data-flow.md §7) — and a manga id. There is no user id in
 * its signature at all, and the user id it forwards is `caller.userId` and
 * nothing else. A caller therefore cannot name a different reader's progress:
 * there is no parameter to substitute, no header to spoof, and no branch that
 * reads a subject id. A role check would be theatre — an `admin` caller reads
 * its OWN progress too, which the unit test pins. The lower-level
 * `ProgressReader.latestForManga(userId, mangaId)` keeps the user id as an
 * explicit parameter only because T-CATALOG-002's catalog wiring already
 * declares that signature; it is not a second identity source, and the catalog
 * service is the one that must pass `caller?.userId`.
 *
 * ── Error contract ────────────────────────────────────────────────────────
 * There is none, by design: "anonymous → null" and "nothing to resume → null"
 * make this function TOTAL, so it never throws and adds no code to
 * API_CONTRACT §6 (AGENTS.md §4.7).
 *
 * ══ SPEC-QUESTIONS (AGENTS.md §6 — recorded, not silently decided) ═════════
 * SQ-1 (the one this task is REQUIRED to raise) — the declared dependency is
 *   over-specified. TASKS.md T-CATALOG-009 says "Depends on: T-CATALOG-001,
 *   T-READER-022 (get progress)", but T-READER-022 sits in VS-2/VS-3, i.e.
 *   AFTER the VS-1 catalog slice that T-CATALOG-009 belongs to, so the
 *   declared edge points backwards. It is also not a real prerequisite:
 *   `reading_progress` already exists from VS-0 (T-FOUND-005,
 *   `src/server/db/schema.ts` §12) and T-READER-022's own goal names THIS
 *   task as its consumer ("fetch session user's position … used by reader open
 *   (T-READER-029) and resume resolution (T-CATALOG-009)"). The reader is the
 *   CONSUMER of a resume decision, not its prerequisite. This module therefore
 *   declares its OWN read port (`ResumePositionReader`, below) and implements
 *   it against the VS-0 table, which makes the task executable in VS-1 without
 *   reordering the roadmap. The roadmap owner should drop the T-READER-022
 *   edge from T-CATALOG-009 (or move both to VS-2) in a spec-fix task; nothing
 *   here assumes that task ran.
 * SQ-2 — "last-read chapter (by progress.updated_at)" (T-CATALOG-009 Goal)
 *   versus "deepest STARTED position" (the same task's Expected behavior, and
 *   `catalog.service.ts`'s header). The two agree while a reader moves forward,
 *   and differ only after going BACK to an earlier chapter: ordering by
 *   `updated_at` would move the continue-reading entry backwards to that
 *   earlier chapter. This implementation follows the Expected-behavior wording
 *   (deepest by `chapter.reading_order`, FR-CHAPTER-004's explicit order) and
 *   reads `updated_at` nowhere. It does NOT fall back to the last UNFINISHED
 *   position when the deepest started chapter is completed — rule 2 says a
 *   completed manga resolves to the next unread chapter or `null`, and rule
 *   5 makes "all complete" a `null`. `tests/integration/progress.resume.test.ts`
 *   pins the divergence with real rows (a newer position on an earlier chapter)
 *   so the alternative reading is one edit away if the owner prefers it.
 * SQ-3 — test id. T-CATALOG-009 asks for "UNIT-PROG-003 sibling tests", but
 *   UNIT-PROG-003 is already allocated in TEST_STRATEGY.md §2 to the sign-in
 *   merge (T-READER-023). "Sibling" is read as "a new id in the same family",
 *   so the resume rules took the next free one, UNIT-PROG-004, and TEST_STRATEGY
 *   §2 needs a row for it (that table is outside this task's write scope).
 * SQ-4 — DATA_MODEL §12 says `completed` is sticky, so "unread" in rule 3 is
 *   "no row, or a row that is not completed". A chapter whose row exists with
 *   `completed = false` after the deepest completed chapter is unreachable in
 *   practice (it would itself be the deepest started position); the loop
 *   tolerates it rather than assuming the invariant.
 * SQ-5 — port placement. `shared/contracts/ports.ts` is the home of the
 *   INFRASTRUCTURE ports (storage/media/telemetry/audit). A reading-progress
 *   read is a feature port, and dependency-rules §2 gives `features/progress`
 *   "defines its own ports" (DAG root). The pre-existing `ProgressReader`
 *   lives in `history.repository.ts` for that reason, and this new port sits
 *   beside it.
 */
import type { CallerContext } from '../../shared/contracts';
import type { ChapterId, MangaId, UserId } from '../../shared/types';
import type { ProgressReader } from './history.repository';

/* ── vocabulary ───────────────────────────────────────────────────────────── */

/**
 * Where a reader resumes — the one shape both consumers (detail page, home
 * continue-reading list) need. T-CATALOG-009 "Expected behavior" 4.
 *
 * Structurally identical to the `ProgressReader.latestForManga` return type in
 * `./history.repository`, which is left untouched so the catalog wiring
 * (T-CATALOG-002) keeps compiling against it.
 */
export interface ResumePosition {
  /** 1-based physical page (DATA_MODEL §10/§12). */
  readonly chapterId: ChapterId;
  readonly chapterNumber: number;
  readonly pageNumber: number;
  /** Vertical offset within the page, 0..1 (FR-READER-012). */
  readonly scrollOffset: number;
}

/** A stored position — present only for a chapter the reader has started. */
export interface ResumePositionFact {
  /** 1-based, `CHECK (page_number >= 1)` (DATA_MODEL §12). */
  readonly pageNumber: number;
  /** Within-page offset; DATA_MODEL §12 declares 0..1 but adds no CHECK. */
  readonly scrollPosition: number;
  /** Sticky (FR-LIBRARY-007); unset only by an explicit unmark (T-LIB-006). */
  readonly completed: boolean;
}

/**
 * One VALID chapter of the manga as the resume rules see it. `position: null`
 * is "this chapter exists and was never started" — a hole the rules walk past.
 */
export interface ResumeChapterFact {
  readonly chapterId: ChapterId;
  /** Special chapters ("10.5") are representable (T-FOUND-005 edge case). */
  readonly chapterNumber: number;
  /** Explicit sort key (FR-CHAPTER-004, `ix_chapters_manga_order`). */
  readonly readingOrder: number;
  /** Committed page count; always ≥ 1 in a snapshot (see the file header). */
  readonly pageCount: number;
  readonly position: ResumePositionFact | null;
}

/**
 * Everything the rules need for one (caller, manga) pair, in reading order.
 *
 * Returned whole rather than per chapter on purpose: the "next unread chapter"
 * scan needs the chapters that have NO progress row, so a read that returned
 * only the reader's own rows could not answer rule 2 — and splitting it would
 * mean two round trips for one decision (NFR-PERF-004).
 */
export interface ResumeSnapshot {
  readonly mangaId: MangaId;
  readonly chapters: readonly ResumeChapterFact[];
}

/* ── the port ─────────────────────────────────────────────────────────────── */

/**
 * `ResumePositionReader` — the ONE read this service needs. Implemented in
 * `server/db/repositories/progress.repository.ts` (T-CATALOG-009).
 *
 * Contract (the repository MUST honour it; the rules below rely on it):
 * - chapters are VALID only: `deleted_at IS NULL`, `status = 'published'`,
 *   `page_count >= 1`;
 * - `position` is the caller's own row for that chapter, or `null`;
 * - a `null` return means "this manga has no readable chapter" — a hidden or
 *   deleted manga, which is 404-shaped null everywhere in the catalog
 *   (API_CONTRACT §1), never an error.
 * - the ORDER BY is an optimization, not a contract: the resolver sorts.
 */
export interface ResumePositionReader {
  readResumeSnapshot(userId: UserId, mangaId: MangaId): Promise<ResumeSnapshot | null>;
}

/* ── the rules ────────────────────────────────────────────────────────────── */

/** 1-based first page; a chapter that was never started starts here. */
const FIRST_PAGE = 1;

/** Clamps a stored page into `[1, pageCount]` (EC-RDR-10). */
function clampPage(stored: number, pageCount: number): number {
  const upper = Math.max(FIRST_PAGE, Math.trunc(pageCount));
  if (!Number.isFinite(stored)) return FIRST_PAGE;
  return Math.min(Math.max(Math.trunc(stored), FIRST_PAGE), upper);
}

/** Clamps a stored offset into the reader's `0..1` invariant (DATA_MODEL §12). */
function clampOffset(stored: number): number {
  if (!Number.isFinite(stored)) return 0;
  return Math.min(Math.max(stored, 0), 1);
}

/** The resume answer for a chapter the reader HAS a position in. */
function positionAt(chapter: ResumeChapterFact, position: ResumePositionFact): ResumePosition {
  return {
    chapterId: chapter.chapterId,
    chapterNumber: chapter.chapterNumber,
    pageNumber: clampPage(position.pageNumber, chapter.pageCount),
    scrollOffset: clampOffset(position.scrollPosition),
  };
}

/** A chapter paired with its (non-null) position — the "started" shape. */
interface StartedChapter {
  chapter: ResumeChapterFact;
  position: ResumePositionFact;
}

/** Type guard for "this chapter was started" (a progress row exists). */
function isStarted(entry: {
  chapter: ResumeChapterFact;
  position: ResumePositionFact | null;
}): entry is StartedChapter {
  return entry.position !== null;
}

/**
 * The whole decision, as a pure function (rules 1–4, see the file header).
 *
 * `null` in, `null` out: a missing snapshot, an empty chapter list, nothing
 * started and nothing unread are all "there is no resume position", and the
 * detail page renders its start/read affordance for each.
 */
export function resolveResumePosition(snapshot: ResumeSnapshot | null): ResumePosition | null {
  if (snapshot === null || snapshot.chapters.length === 0) return null;

  // Defensive sort: the ORDER BY is the repository's optimization, "deepest" is
  // defined by `reading_order`, and the port does not promise an order.
  const ordered = [...snapshot.chapters].sort((a, b) => a.readingOrder - b.readingOrder);

  // Rule 1: the deepest chapter that was STARTED — completed counts as started.
  const started = ordered
    .map((chapter) => ({ chapter, position: chapter.position }))
    .filter(isStarted);
  const deepest = started[started.length - 1];
  // Rule 1: nothing was ever started → nothing to resume.
  if (deepest === undefined) return null;

  // The deepest position is still open: that IS the resume point.
  if (!deepest.position.completed) return positionAt(deepest.chapter, deepest.position);

  // Rules 2/3: it is completed → the next chapter that is not completed, at its
  // start. It has no stored position, so page 1 / offset 0 is the whole answer.
  // `reading_order` is unique per manga (`ix_chapters_manga_order`), so this walk
  // resumes exactly where the deepest chapter left off, holes included.
  for (const chapter of ordered) {
    if (chapter.readingOrder <= deepest.chapter.readingOrder) continue;
    if (chapter.position?.completed === true) continue;
    return {
      chapterId: chapter.chapterId,
      chapterNumber: chapter.chapterNumber,
      pageNumber: FIRST_PAGE,
      scrollOffset: 0,
    };
  }

  // Rule 4: everything readable is finished → null (the detail page's "read" state).
  return null;
}

/* ── the service ──────────────────────────────────────────────────────────── */

/**
 * The caller-facing surface. It EXTENDS the pre-existing `ProgressReader`
 * port, so the object this factory returns can be handed straight to
 * `CatalogService`'s `progress` dependency (`catalog.service.ts`,
 * T-CATALOG-002's wiring) without a second adapter — and so that the
 * catalog's `resolveResume(mangaId, caller)` has an anonymous-safe entry point
 * to delegate to.
 */
export interface ResumeService extends ProgressReader {
  /**
   * FR-CATALOG-008 / T-CATALOG-009. `caller: null` (anonymous) → `null`, and
   * NOT an error: the reader's position lives on the device until sign-in
   * (T-READER-024), so the server has nothing to say.
   */
  resolveResume(mangaId: MangaId, caller: CallerContext): Promise<ResumePosition | null>;
}

/**
 * Wires the resume rules to a progress read.
 *
 * T-CATALOG-009. The composition root passes the Drizzle implementation
 * (composition wiring is T-CATALOG-002's task, not this one's — the factory is
 * exported so that root can inject it without importing the repository).
 */
export function createResumeService(deps: { reads: ResumePositionReader }): ResumeService {
  async function resolve(userId: UserId, mangaId: MangaId): Promise<ResumePosition | null> {
    return resolveResumePosition(await deps.reads.readResumeSnapshot(userId, mangaId));
  }
  return {
    /**
     * The session caller is the ONLY identity source (THREAT T-04); an
     * anonymous request never reaches the database at all.
     */
    async resolveResume(mangaId, caller) {
      if (caller === null) return null;
      return resolve(caller.userId, mangaId);
    },
    /**
     * `ProgressReader` port. `mangaId` is typed `string` by that port
     * (T-CATALOG-002's signature); narrowing it to the brand here is what
     * keeps the read below typed without changing the published port.
     */
    async latestForManga(userId, mangaId) {
      return resolve(userId, mangaId as MangaId);
    },
  };
}
