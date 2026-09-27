/**
 * server/db/repositories/chapter.repository — the `ChapterRepository` port
 * against PostgreSQL (T-CATALOG-001).
 *
 * Authority: DATA_MODEL.md §9 (chapter) and §10 (chapter_page), §21.2/§21.3
 * (pages are contiguous 1..N at "ready"; a published chapter always has
 * pages); the `ChapterRepository` port in `features/chapters` (its invariants
 * are binding); API_CONTRACT.md §2.1 (pages op shape).
 *
 * Requirements: FR-CHAPTER-001…004, FR-CATALOG-007, FR-READER-016,
 * FR-UPLOAD-006/009, FR-MEDIA-002/003, NFR-DATA-001, NFR-DATA-002,
 * NFR-SEC-015, NFR-PERF-004/008/014.
 * Tasks: T-CATALOG-001 (this file), T-CATALOG-007 (chapter list service),
 * T-READER-002 (pages API), T-UPLOAD-006/007/009 (the commit path that calls
 * `commitPages`), T-PERF-004 (the EXPLAIN gate below).
 *
 * ── ORDER IS `reading_order`, AND ONLY `reading_order` ────────────────────
 * `ix_chapters_manga_order` is UNIQUE on `(manga_id, reading_order)`
 * (DATA_MODEL §9, NFR-PERF-014), so the required order is exactly the index's
 * order and there is no tiebreaker to reason about (FR-CHAPTER-004) — unlike
 * `manga`, whose sort keys are not unique and whose cursors therefore need `id`.
 * PostgreSQL still chooses the scan SHAPE: for a short chapter list it may scan
 * the index as a bitmap and sort the (already few) rows, for a long one it walks
 * the index in order. Both are index-backed, which is what NFR-PERF-014 and the
 * T-PERF-004 gate require; the gate asserts the index, not the node type.
 * `create` DERIVES `reading_order` from the chapter `number`
 * (×100, the smallest injective scale for `numeric(8,2)`), so "order by number"
 * and "order by reading_order" are the same order by construction, and the
 * UNIQUE index can never be violated by a fractional chapter such as 10.5.
 * `ix_chapters_visible` cannot serve a per-manga list (its leading column is
 * `reading_order` alone, with no `manga_id`), which is exactly why DATA_MODEL §9
 * makes the composite the chapter-list hot path.
 *
 * ── READABILITY IS THE COMPOSITION OF TWO RULES ───────────────────────────
 * A chapter is readable when BOTH hold (FR-CHAPTER-002):
 *   1. the chapter axis — published, or a draft for an admin (rendered ONCE, as
 *      `chapterVisibleWhere`, in `manga.repository.ts`, and imported here so it
 *      is never stated twice); and
 *   2. the manga axis — the parent title must itself be readable (the very same
 *      rendering of `isMangaVisible` that the catalog list uses).
 * This module therefore IMPORTS the manga rule rather than restating it; a
 * chapter of a draft or soft-deleted manga is unreadable, and that is asserted
 * against a real table by INT-CHAP-001.
 *
 * ── NO N+1 ────────────────────────────────────────────────────────────────
 * `pageList` is a fixed FOUR statements: the chapter+manga row, the page range
 * scan on the `chapter_page` PK, and one index seek each for the previous and
 * next visible neighbour. The 500-page list is ONE query of ~500 small rows
 * (the reader's ~60 KB budget, T-READER-002) — never one query per page.
 *
 * ── `commitPages` IS THE UPLOAD COMMIT (FR-UPLOAD-006) ────────────────────
 * Insert the full 1..N page set and update `page_count` in ONE transaction, so
 * a published chapter can never exist without its pages (DATA_MODEL §21.3).
 * Concurrency is serialised on a transaction-scoped advisory lock keyed by the
 * chapter id, so two commits for the same chapter queue instead of interleaving
 * (T-UPLOAD-006's edge case). The contiguity assertion happens BEFORE the
 * transaction, so a bad page set costs no round trip and writes nothing.
 *
 * ── ERRORS ────────────────────────────────────────────────────────────────
 * Only codes already in API_CONTRACT §6: `CHAPTER_NOT_READY` (a page set that
 * is not exactly 1..N), `CHAPTER_NOT_FOUND`, `CHAPTER_DUPLICATE_NUMBER`
 * (`ix_chapters_number`), `MANGA_NOT_FOUND` (the manga-deleted race). No §6
 * change is needed (AGENTS.md §4.7). Driver errors travel as `cause` and never
 * become a message (NFR-OBS-006) — in particular an `asset_key` never appears in
 * one.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  lt,
  sql,
  type SQL,
} from 'drizzle-orm';
import type {
  ChapterPageRecord,
  ChapterPagesResponse,
  ChapterSummary,
  CallerContext,
  PageAsset,
  ReadingDirection,
} from '../../../shared/contracts';
import { AppError } from '../../../shared/contracts/errors';
import type { ChapterRepository } from '../../../features/chapters';
import type { AssetKey, ChapterId, MangaId, MangaSlug } from '../../../shared/types';
import type { Db } from '../client';
import { chapter, chapterPage, manga } from '../schema';
import { chapterVisibleWhere, mangaReadClauses, mayReadDrafts } from './manga.repository';

/** The slice of a Drizzle handle a helper needs; a transaction satisfies it. */
type Executor = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

/** The `sql\`now()\`` stamp, matching the columns' `DEFAULT now()`. */
const STAMP = sql`now()`;

/* ── row shapes and row → DTO mapping (data-flow.md §7) ──────────────────── */

/** The scalar columns the ChapterSummary/pageList shapes read. */
const CHAPTER_COLUMNS = {
  id: chapter.id,
  mangaId: chapter.mangaId,
  number: chapter.number,
  title: chapter.title,
  status: chapter.status,
  publishedAt: chapter.publishedAt,
  pageCount: chapter.pageCount,
  readingOrder: chapter.readingOrder,
  createdAt: chapter.createdAt,
  updatedAt: chapter.updatedAt,
  deletedAt: chapter.deletedAt,
};

interface ChapterRow {
  id: string;
  mangaId: MangaId;
  number: string;
  title: string | null;
  status: string;
  publishedAt: Date | null;
  pageCount: number;
  readingOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** `numeric(8,2)` arrives as a string; the DTOs say `number` (ADR-003 R2). */
function asNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function asIso(value: Date): string {
  return value.toISOString();
}

function toSummary(row: ChapterRow): ChapterSummary {
  return {
    id: row.id as ChapterId,
    number: asNumber(row.number),
    title: row.title,
    pageCount: row.pageCount,
    // Null for a draft (FR-CHAPTER-002); the DTO allows it explicitly.
    publishedAt: row.publishedAt === null ? null : asIso(row.publishedAt),
  };
}

/** `/media/{assetKey}` — app-relative, never a storage URL (FR-MEDIA-003). */
function pageUrl(assetKey: string): string {
  return `/media/${assetKey}`;
}

function toPageAsset(row: {
  pageNumber: number;
  assetKey: string;
  width: number;
  height: number;
}): PageAsset {
  const url = pageUrl(row.assetKey);
  return {
    pageNumber: row.pageNumber,
    // The three variants share one key: `/media/{key}` negotiates the stored
    // format by `Accept` (API_CONTRACT §2.1, ADR-005), so all three URLs are
    // the same app-relative path.
    urlAvif: url,
    urlWebp: url,
    urlJpeg: url,
    width: row.width,
    height: row.height,
  };
}

/**
 * `ChapterPageRecord.id`.
 *
 * spec-question for the document owner: `DATA_MODEL.md` §10 states the primary
 * key as the composite `(chapter_id, page_number)` and lists NO `id` column, but
 * `shared/contracts/chapter.ts` types the record's `id` as a string. The
 * composite is rendered as `"{chapterId}:{pageNumber}"` — deterministic,
 * unique, and derived from the real key, so nothing is invented. A DATA_MODEL
 * amendment should either add the column or drop it from the DTO.
 */
function pageRecordId(chapterId: string, pageNumber: number): string {
  return `${chapterId}:${pageNumber}`;
}

/* ── driver-error classification ─────────────────────────────────────────── */

/**
 * A postgres.js unique violation carries `23505` and often the index name.
 *
 * The chain is walked because Drizzle wraps every failure in its own
 * `DrizzleQueryError` and keeps the original in `cause`; inspecting only the
 * outermost object would classify every constraint violation as unknown and
 * lose the typed 409 (AGENTS.md §4.7).
 */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current: unknown = error, depth = 0; current !== null && depth < 5; depth += 1) {
    if (typeof current !== 'object') return false;
    const candidate = current as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (candidate.code === '23505') {
      return candidate.constraint_name === undefined || candidate.constraint_name === constraint;
    }
    current = candidate.cause;
  }
  return false;
}

/** A foreign-key violation: the parent row does not exist (23503). */
function isForeignKeyViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current !== null && depth < 5; depth += 1) {
    if (typeof current !== 'object') return false;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === '23503') return true;
    current = candidate.cause;
  }
  return false;
}

/* ── query builders (one definition each; the factory and the gate share them) */

/**
 * The chapter list for one manga, ordered by `reading_order`.
 *
 * Index: `ix_chapters_manga_order` — the UNIQUE `(manga_id, reading_order)`
 * index. With `manga_id` pinned, the index scan IS the required order
 * (FR-CHAPTER-004, NFR-PERF-014).
 *
 * The caller decides draft visibility; the manga axis is checked by the caller
 * too (see {@link buildChapterListQuery}'s wrapper `listByManga`), because the
 * two rules are about different tables.
 */
export function buildChapterListQuery(db: Db, mangaId: MangaId, caller: CallerContext) {
  return db
    .select({ ...CHAPTER_COLUMNS })
    .from(chapter)
    .where(and(eq(chapter.mangaId, mangaId), chapterVisibleWhere(mayReadDrafts(caller))))
    .orderBy(chapter.readingOrder);
}

/**
 * The page range scan for one chapter, ascending by `page_number`.
 *
 * Index: the `chapter_page` PRIMARY KEY `(chapter_id, page_number)`, so this
 * reads N rows through that index — never a table scan, and never one query per
 * page (NFR-PERF-004/008, T-READER-002). The scan shape (ordered range scan vs
 * bitmap + sort) is PostgreSQL's cost decision; the index is not.
 */
export function buildChapterPagesQuery(db: Db, chapterId: ChapterId) {
  return db
    .select({
      chapterId: chapterPage.chapterId,
      pageNumber: chapterPage.pageNumber,
      assetKey: chapterPage.assetKey,
      width: chapterPage.width,
      height: chapterPage.height,
      byteSizeAvif: chapterPage.byteSizeAvif,
      byteSizeWebp: chapterPage.byteSizeWebp,
      byteSizeJpeg: chapterPage.byteSizeJpeg,
    })
    .from(chapterPage)
    .where(eq(chapterPage.chapterId, chapterId))
    .orderBy(chapterPage.pageNumber);
}

/** One index seek: the visible chapter immediately before / after `readingOrder`. */
function neighbourQuery(
  db: Db,
  mangaId: MangaId,
  readingOrder: number,
  direction: 'prev' | 'next',
  includeDrafts: boolean,
) {
  const boundary =
    direction === 'prev'
      ? lt(chapter.readingOrder, readingOrder)
      : gt(chapter.readingOrder, readingOrder);
  return db
    .select({ ...CHAPTER_COLUMNS })
    .from(chapter)
    .where(and(eq(chapter.mangaId, mangaId), boundary, chapterVisibleWhere(includeDrafts)))
    .orderBy(
      ...(direction === 'prev'
        ? [desc(chapter.readingOrder)]
        : [asc(chapter.readingOrder)]),
    )
    .limit(1);
}

/** Whether this manga is readable by this caller (the manga axis, FR-CHAPTER-002). */
async function mangaReadable(
  db: Db,
  mangaId: MangaId,
  caller: CallerContext,
): Promise<boolean> {
  const rows = await db
    .select({ id: manga.id })
    .from(manga)
    .where(and(eq(manga.id, mangaId), ...mangaReadClauses(caller)))
    .limit(1);
  return rows.length > 0;
}

/** Whether this chapter is readable by this caller (both axes, FR-CHAPTER-002). */
async function chapterReadable(
  db: Db,
  chapterId: ChapterId,
  caller: CallerContext,
): Promise<ChapterRow | null> {
  // The manga axis needs the parent row in scope, so this is a join rather than
  // a second statement: the manga PK is a single-row lookup either way, and one
  // statement keeps the decision ("is this chapter readable at all?") in one
  // place instead of splitting it across a read and a check.
  const rows = (await db
    .select({ ...CHAPTER_COLUMNS })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .where(
      and(
        eq(chapter.id, chapterId),
        chapterVisibleWhere(mayReadDrafts(caller)),
        ...mangaReadClauses(caller),
      ),
    )
    .limit(1)) as ChapterRow[];
  return rows[0] ?? null;
}

/**
 * The parent manga's slug/title/direction, for `ChapterPagesResponse.chapter`.
 *
 * Called only after `chapterReadable` proved the parent is readable, so the
 * `?? ''` defaults are unreachable; they exist so a dropped join can never throw
 * a second error on top of the 404 the caller is about to return.
 */
async function mangaShape(
  db: Db,
  mangaId: MangaId,
): Promise<{ slug: MangaSlug; title: string; readingDirection: ReadingDirection }> {
  const rows = await db
    .select({
      slug: manga.slug,
      title: manga.title,
      readingDirection: manga.readingDirection,
    })
    .from(manga)
    .where(eq(manga.id, mangaId))
    .limit(1);
  const row = rows[0];
  return {
    slug: (row?.slug ?? '') as MangaSlug,
    title: row?.title ?? '',
    // Anything other than the CHECK's two values cannot be stored
    // (DATA_MODEL §3), so this is a narrowing, not a guess.
    readingDirection: row?.readingDirection === 'ltr' ? 'ltr' : 'rtl',
  };
}

/* ── the repository ──────────────────────────────────────────────────────── */

/**
 * Builds the Drizzle `ChapterRepository`.
 *
 * @param db the application's handle from `createDb(env)` — the only place a
 *   connection is ever needed (ADR-003, dependency rule D2).
 */
export function createChapterRepository(db: Db): ChapterRepository {
  /**
   * Asserts a page set is exactly `1..N` — DATA_MODEL §21.2's contiguity
   * invariant, which the commit path is the only writer of.
   *
   * Checked BEFORE any statement, so a bad set writes nothing and costs no round
   * trip. The `page_number >= 1` CHECK in the schema catches a single bad
   * value; this catches the gap (`1,2,4`) the CHECK cannot see.
   */
  function assertContiguous(pageNumbers: readonly number[]): void {
    if (pageNumbers.length === 0) throw new AppError('CHAPTER_NOT_READY');
    const sorted = [...pageNumbers].sort((left, right) => left - right);
    for (let offset = 0; offset < sorted.length; offset += 1) {
      if (sorted[offset] !== offset + 1) throw new AppError('CHAPTER_NOT_READY');
    }
  }

  async function createPageRecords(
    executor: Executor,
    chapterId: ChapterId,
    pages: readonly { pageNumber: number; assetKey: string; width: number; height: number; byteSizeAvif: number | null; byteSizeWebp: number | null; byteSizeJpeg: number | null }[],
  ): Promise<void> {
    await executor
      .insert(chapterPage)
      .values(pages.map((page) => ({ chapterId, ...page })));
  }

  return {
    async listByManga(mangaId: MangaId, caller: CallerContext): Promise<ChapterSummary[]> {
      // The manga axis first (one PK seek on `manga`), so a hidden title's
      // chapter list is `[]` rather than an index scan of chapters nobody may
      // read (FR-CHAPTER-002, FR-ADMIN-003).
      if (!(await mangaReadable(db, mangaId, caller))) return [];
      const rows = (await buildChapterListQuery(db, mangaId, caller)) as ChapterRow[];
      return rows.map(toSummary);
    },

    async byId(id: ChapterId, caller: CallerContext): Promise<ChapterSummary | null> {
      const row = await chapterReadable(db, id, caller);
      return row === null ? null : toSummary(row);
    },

    async pageList(id: ChapterId, caller: CallerContext): Promise<ChapterPagesResponse | null> {
      const row = await chapterReadable(db, id, caller);
      // 404-shaped for a draft, a deleted chapter, a deleted manga, or an id
      // that never existed — the four are indistinguishable to a reader.
      if (row === null) return null;
      const includeDrafts = mayReadDrafts(caller);
      const [parent, pages, prev, next] = await Promise.all([
        mangaShape(db, row.mangaId),
        buildChapterPagesQuery(db, row.id as ChapterId),
        neighbourQuery(db, row.mangaId, row.readingOrder, 'prev', includeDrafts),
        neighbourQuery(db, row.mangaId, row.readingOrder, 'next', includeDrafts),
      ]);
      const neighbour = (found: ChapterRow | undefined) =>
        found === undefined
          ? null
          : { slug: parent.slug, number: asNumber(found.number), title: found.title };
      return {
        chapter: {
          id: row.id as ChapterId,
          mangaSlug: parent.slug,
          mangaTitle: parent.title,
          number: asNumber(row.number),
          title: row.title,
          readingDirection: parent.readingDirection,
          pageCount: row.pageCount,
        },
        pages: pages.map(toPageAsset),
        // FR-READER-016: neighbours are published-only for a non-admin, which
        // `neighbourQuery` already applied through `chapterVisibleWhere`.
        prevChapter: neighbour(prev[0] as ChapterRow | undefined),
        nextChapter: neighbour(next[0] as ChapterRow | undefined),
      };
    },

    async pageRecords(chapterId: ChapterId): Promise<ChapterPageRecord[]> {
      // Server-side view, no visibility gate: this is the commit-verification
      // and media-GC path (T-UPLOAD-009), not a reader surface.
      const rows = await buildChapterPagesQuery(db, chapterId);
      return rows.map((row) => ({
        id: pageRecordId(row.chapterId, row.pageNumber),
        chapterId: row.chapterId as ChapterId,
        pageNumber: row.pageNumber,
        assetKey: row.assetKey as AssetKey,
        width: row.width,
        height: row.height,
        byteSizeAvif: row.byteSizeAvif,
        byteSizeWebp: row.byteSizeWebp,
        byteSizeJpeg: row.byteSizeJpeg,
      }));
    },

    async create(input: {
      mangaId: MangaId;
      number: number;
      title: string | null;
      notes: string;
    }): Promise<ChapterId> {
      try {
        return await db.transaction(async (tx) => {
          // The parent must exist and must not be soft-deleted (FR-ADMIN-003).
          // The port's `create` carries no caller, so the DRAFT axis is not
          // checked: an admin creates chapters on a draft title every day, and
          // the publish path is the thing that enforces FR-CHAPTER-002.
          const parent = await tx
            .select({ id: manga.id })
            .from(manga)
            .where(and(eq(manga.id, input.mangaId), sql`${manga.deletedAt} is null`))
            .limit(1);
          if (parent.length === 0) throw new AppError('MANGA_NOT_FOUND');
          const [row] = await tx
            .insert(chapter)
            .values({
              mangaId: input.mangaId,
              // numeric(8,2): bound as a string so 10.5 stays exact (ADR-003 R2).
              number: input.number.toFixed(2),
              title: input.title,
              notes: input.notes,
              // A new chapter is a DRAFT; `setPublished` is the only way in
              // (FR-CHAPTER-002).
              status: 'draft',
              // `reading_order` is the stored order key (FR-CHAPTER-004, and the
              // leading half of the UNIQUE `ix_chapters_manga_order`), and the
              // port's `create` carries no order field, so the repository
              // derives it from the chapter NUMBER: order is "by number", and
              // the integer column is the indexable form of that.
              //
              // ×100 is the smallest injective factor for `numeric(8,2)`: two
              // distinct numbers always scale to distinct integers, so the
              // UNIQUE index can never be violated by a fractional chapter
              // (1.00 → 100, 10.50 → 1050, 11.00 → 1100). `floor()` would
              // collide chapter 10 with the special chapter 10.5. The scale is
              // invisible to readers — the DTOs expose `number`, never
              // `reading_order` — and the seed harness uses the same
              // "reading_order tracks the number" convention
              // (`Number.parseInt(number)` for the integer chapters it makes).
              readingOrder: sql`(${input.number.toFixed(2)}::numeric * 100)::int`,
            })
            .returning({ id: chapter.id });
          const id = row?.id as ChapterId | undefined;
          if (id === undefined) throw new AppError('CHAPTER_NOT_FOUND');
          return id;
        });
      } catch (error) {
        if (isUniqueViolation(error, 'ix_chapters_number')) {
          throw new AppError('CHAPTER_DUPLICATE_NUMBER');
        }
        if (isForeignKeyViolation(error)) throw new AppError('MANGA_NOT_FOUND');
        throw error;
      }
    },

    async update(
      id: ChapterId,
      patch: Partial<{ number: number; title: string | null; notes: string }>,
    ): Promise<void> {
      const values: Partial<{
        number: string;
        title: string | null;
        notes: string;
        updatedAt: SQL;
      }> = { updatedAt: STAMP };
      if (patch.number !== undefined) values.number = patch.number.toFixed(2);
      if (patch.title !== undefined) values.title = patch.title;
      if (patch.notes !== undefined) values.notes = patch.notes;
      // ONE statement, so a refused patch (a duplicate `number`, FR-CHAPTER-001)
      // cannot half-apply: the whole UPDATE is rolled back by PostgreSQL.
      try {
        await db.update(chapter).set(values).where(eq(chapter.id, id));
      } catch (error) {
        if (isUniqueViolation(error, 'ix_chapters_number')) {
          throw new AppError('CHAPTER_DUPLICATE_NUMBER');
        }
        throw error;
      }
    },

    async softDelete(id: ChapterId): Promise<void> {
      // Idempotent by construction (NFR-DATA-002), and never touches a row that
      // is already soft-deleted, so the stamp cannot be re-taken.
      await db
        .update(chapter)
        .set({ deletedAt: STAMP, updatedAt: STAMP })
        .where(and(eq(chapter.id, id), sql`${chapter.deletedAt} is null`));
    },

    async setPublished(id: ChapterId, published: boolean): Promise<void> {
      // `published_at` is the publish stamp and is cleared on unpublish, so a
      // draft's `publishedAt` is null in the DTO (FR-CHAPTER-002).
      await db
        .update(chapter)
        .set({
          status: published ? 'published' : 'draft',
          publishedAt: published ? STAMP : null,
          updatedAt: STAMP,
        })
        .where(eq(chapter.id, id));
    },

    async commitPages(input: {
      chapterId: ChapterId;
      pages: readonly {
        pageNumber: number;
        assetKey: string;
        width: number;
        height: number;
        byteSizeAvif: number | null;
        byteSizeWebp: number | null;
        byteSizeJpeg: number | null;
      }[];
      replace: boolean;
    }): Promise<{ replacedAssetKeys: string[] }> {
      // Before the transaction: a page set that is not exactly 1..N is refused
      // with no write and no round trip (DATA_MODEL §21.2, T-UPLOAD-007).
      assertContiguous(input.pages.map((page) => page.pageNumber));

      return db.transaction(async (tx) => {
        // Serialise commits for ONE chapter. A session-level lock would be wrong
        // here: `db.transaction` may hand the transaction a different pooled
        // connection than the lock, which would make the lock a lie. The
        // transaction-scoped form dies with the transaction instead.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${input.chapterId}::text, 0))`,
        );

        // The manga-deleted race (T-UPLOAD-007): a soft delete that landed
        // between the upload and this commit must fail loudly, not write pages
        // nobody can reach.
        const chapterRows = (await tx
          .select({ ...CHAPTER_COLUMNS })
          .from(chapter)
          .where(and(eq(chapter.id, input.chapterId), sql`${chapter.deletedAt} is null`))
          .limit(1)) as ChapterRow[];
        const target = chapterRows[0];
        if (target === undefined) throw new AppError('CHAPTER_NOT_FOUND');
        const parentRows = await tx
          .select({ id: manga.id })
          .from(manga)
          .where(and(eq(manga.id, target.mangaId), sql`${manga.deletedAt} is null`))
          .limit(1);
        if (parentRows.length === 0) throw new AppError('MANGA_NOT_FOUND');

        const replacedAssetKeys: string[] = [];
        if (input.replace) {
          // Re-ingest (FR-UPLOAD-009): collect the OLD keys first so the caller
          // can queue them for GC, then replace the set atomically.
          const old = await tx
            .select({ assetKey: chapterPage.assetKey })
            .from(chapterPage)
            .where(eq(chapterPage.chapterId, input.chapterId));
          replacedAssetKeys.push(...old.map((row) => row.assetKey));
          await tx.delete(chapterPage).where(eq(chapterPage.chapterId, input.chapterId));
        }
        await createPageRecords(tx, input.chapterId, input.pages);
        // The denormalized counter is written WITH the rows it counts, in the
        // same transaction (NFR-PERF-014).
        await tx
          .update(chapter)
          .set({ pageCount: input.pages.length, updatedAt: STAMP })
          .where(eq(chapter.id, input.chapterId));
        return { replacedAssetKeys };
      });
    },

    async countByManga(mangaId: MangaId): Promise<number> {
      // The port takes no caller, so this is the READER's count: published,
      // undeleted chapters (FR-CHAPTER-002).
      const [row] = await db
        .select({ total: count() })
        .from(chapter)
        .where(and(eq(chapter.mangaId, mangaId), chapterVisibleWhere(false)));
      return Number(row?.total ?? 0);
    },

    async countAll(): Promise<number> {
      const [row] = await db.select({ total: count() }).from(chapter);
      return Number(row?.total ?? 0);
    },

    async countPages(): Promise<number> {
      const [row] = await db.select({ total: count() }).from(chapterPage);
      return Number(row?.total ?? 0);
    },
  };
}
