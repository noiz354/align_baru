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
 * The single visibility rule (unit-tested, T-CATALOG-001):
 * a manga is publicly visible iff published && !deleted.
 * TODO(T-CATALOG-001): implement (one line + tests).
 */
export function isMangaVisible(m: { published: boolean; deletedAt: string | null }): boolean {
  throw new Error('Not implemented: T-CATALOG-001 (visibility rule)');
}
