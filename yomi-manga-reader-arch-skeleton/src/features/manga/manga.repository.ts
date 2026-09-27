/**
 * MangaRepository port (features/manga owns the aggregate rules;
 * server/db implements against DATA_MODEL §3–8).
 *
 * Requirements: FR-CATALOG-001…006, FR-ADMIN-001…003, NFR-DATA-001/002.
 * Tasks: T-CATALOG-001 (implementation), INT-CAT-001.
 *
 * Invariants:
 * - `slug` is the public identity (unique); immutable after first publish
 *   (EC-ADM-07) — enforced by the admin service, not here.
 * - Soft-delete is a flag (NFR-DATA-002); hard purge is ops-only.
 * - The catalog hot path MUST use the partial index `ix_manga_visible`
 *   (NFR-PERF-014, T-PERF-004 EXPLAIN gate) — the implementation comment
 *   must name the index it relies on.
 * - Visibility rule `published && deletedAt === null` is a single
 *   unit-tested function in this module (reused by search, detail,
 *   chapter reads — no re-implementation).
 */
import type { CallerContext, MangaDetail, MangaStatus, MangaSummary, ReadingDirection } from '../../shared/contracts';
import type { MangaId, MangaSlug } from '../../shared/types';

export interface CatalogQuery {
  cursor?: string;
  limit?: number; // ≤ 48
  genres?: string[]; // slugs, ≤ 5 (unknown slugs ignored, not errors)
  status?: MangaStatus;
  sort?: 'title_asc' | 'updated_desc' | 'added_desc';
}

export interface MangaRepository {
  /** Public detail (visibility rule applied). 404-shaped for hidden. */
  bySlug(slug: MangaSlug, caller: CallerContext): Promise<MangaDetail | null>;

  /** Catalog list (published & non-deleted only). */
  list(query: CatalogQuery): Promise<{ items: MangaSummary[]; nextCursor: string | null }>;

  /** Admin list (includes drafts/deleted; admin UI only). */
  adminList(query: CatalogQuery & { includeDeleted?: boolean }): Promise<{ items: MangaDetail[]; nextCursor: string | null }>;

  create(input: {
    title: string;
    slug: MangaSlug;
    synopsis: string;
    status: MangaStatus;
    readingDirection: ReadingDirection;
    aliases: string[];
    genreIds: string[];
    tagIds: string[];
    creators: Array<{ name: string; role: 'author' | 'artist' | 'other' }>;
  }): Promise<MangaId>;

  update(id: MangaId, patch: Partial<{
    title: string; synopsis: string; status: MangaStatus; readingDirection: ReadingDirection;
    aliases: string[]; genreIds: string[]; tagIds: string[];
    creators: Array<{ name: string; role: 'author' | 'artist' | 'other' }>;
  }>): Promise<void>;

  setCover(id: MangaId, coverAssetKey: string | null): Promise<void>;

  /** Soft-delete (NFR-DATA-002). Idempotent. */
  softDelete(id: MangaId): Promise<void>;
  restore(id: MangaId): Promise<void>;

  setPublished(id: MangaId, published: boolean): Promise<void>;

  count(): Promise<number>; // stats (FR-ADMIN-008)
}

/**
 * ONE clause of the visibility rule, as DATA.
 *
 * The rule has to exist in two places — as a TypeScript predicate (unit tests,
 * in-memory callers) and as a SQL predicate (the repository's WHERE clause) —
 * and a `features/*` module may not import drizzle (boundary rule D2), so the
 * SQL cannot be built here. Expressing the rule as a clause list rather than
 * duplicating the literals means it is DEFINED once, in this array, and only
 * RENDERED twice. `server/db/repositories/manga.repository.ts` maps each clause
 * to `eq()`/`isNull()`; INT-CAT-001 asserts the two agree row for row against a
 * real table, so the rendering cannot drift from the rule.
 *
 * Invariant: one clause per visibility axis of DATA_MODEL §3 — `published`
 * (FR-CHAPTER-002) and `deleted_at` (NFR-DATA-002 / FR-ADMIN-003). Adding an
 * axis means adding a clause here, never a second `&&` somewhere else.
 */
export interface MangaVisibilityClause {
  /** The manga column the clause reads. */
  readonly column: 'published' | 'deletedAt';
  /** Required value; `null` means "must be NULL", which is SQL `IS NULL`. */
  readonly equals: boolean | null;
}

/** The visibility rule itself: `published === true && deletedAt === null`. */
export const MANGA_VISIBILITY_CLAUSES: readonly MangaVisibilityClause[] = [
  { column: 'published', equals: true },
  { column: 'deletedAt', equals: null },
];

/**
 * The single visibility rule (unit-tested, T-CATALOG-001):
 * a manga is publicly visible iff published && !deleted.
 *
 * FR-CHAPTER-002, FR-ADMIN-003, NFR-DATA-002. The ONLY place the rule is
 * evaluated: search, detail, chapter reads and the catalog list all call this
 * (or, in SQL, the rendering of {@link MANGA_VISIBILITY_CLAUSES}) — never a
 * hand-written second copy.
 *
 * Edge cases covered by the truth table: an unpublished but undeleted title is
 * hidden (a draft); a published but soft-deleted title is hidden; both axes
 * failing is hidden. A manga with no `deletedAt` is by definition undeleted.
 */
export function isMangaVisible(m: { published: boolean; deletedAt: string | Date | null }): boolean {
  return MANGA_VISIBILITY_CLAUSES.every((clause) => {
    const value: unknown = m[clause.column];
    return value === clause.equals;
  });
}
