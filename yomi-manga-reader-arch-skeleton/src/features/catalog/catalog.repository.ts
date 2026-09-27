/**
 * Catalog query types (re-exported for the service + web layer).
 * The query types live with the catalog service's contract; the repository
 * ports themselves are owned by features/manga and features/chapters
 * (dependency-rules.md §2: catalog uses those ports, not its own copy).
 *
 * ── T-CATALOG-002: the RUNTIME side of the same contract ─────────────────
 * The union types above are compile-time whitelists; a query string is not
 * typed, so the runtime whitelists below are the actual T-02 control
 * (Security row: "sort/status whitelists"). They are `as const` arrays and the
 * `satisfies` clauses re-check every member against the union, so a sort
 * removed from `CatalogQuery` cannot survive here — the two lists cannot drift.
 *
 * The limits are the ones API_CONTRACT §2.1 states: `limit?` (≤ 48) and
 * `genre?` (csv slugs, ≤ 5). FR-CATALOG-001 states the page default (24).
 *
 * Requirements: FR-CATALOG-001…004, NFR-SEC-015. Task: T-CATALOG-002.
 */
import type { MangaStatus } from '../../shared/contracts';

export interface CatalogQuery {
  cursor?: string;
  limit?: number; // default 24, ≤ 48
  genres?: string[]; // ≤ 5 slugs
  status?: MangaStatus;
  sort?: 'title_asc' | 'updated_desc' | 'added_desc'; // default updated_desc
}

/**
 * Sort whitelist (T-02, API_CONTRACT §2.1).
 *
 * These are the three orders FR-CATALOG-004 names: title A–Z, most recently
 * updated, most recently added. There is no fourth anywhere in the spec suite,
 * and the same union is the `MangaRepository.list` parameter — a fourth order
 * would be a spec change across four files, not a local addition.
 */
export const CATALOG_SORTS = [
  'title_asc',
  'updated_desc',
  'added_desc',
] as const satisfies readonly NonNullable<CatalogQuery['sort']>[];

/** Status whitelist (T-02, API_CONTRACT §2.1: ongoing/completed/hiatus). */
export const CATALOG_STATUSES = [
  'ongoing',
  'completed',
  'hiatus',
] as const satisfies readonly MangaStatus[];

/** FR-CATALOG-001: "cursor-based pagination (default 24/page)". */
export const CATALOG_DEFAULT_LIMIT = 24;

/** API_CONTRACT §2.1: `limit?` (≤ 48). Values above it are clamped, not 422. */
export const CATALOG_MAX_LIMIT = 48;

/** API_CONTRACT §2.1: `genre?` (csv slugs, ≤ 5). A sixth slug IS a 422. */
export const CATALOG_MAX_GENRES = 5;

/**
 * The longest slug a `genre` name can slugify to. DATA_MODEL §6 puts no length
 * on `genre.name`, so this is a bound on the INPUT, chosen so a hostile csv
 * cannot be handed to the repository as an unbounded string; the repository
 * still matches it as a bound value (NFR-SEC-015).
 */
export const CATALOG_MAX_GENRE_SLUG_LENGTH = 64;

/**
 * What a genre slug may contain: lowercase letters, digits, and single inner
 * separators. Deliberately closed — no quotes, no spaces, no SQL punctuation —
 * so a payload like `' OR 1=1--` can never be a genre slug (T-02 fuzz).
 */
const GENRE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalises one raw `genre` csv token to a comparable slug, or null when the
 * token cannot name a genre row.
 *
 * Requirements: FR-CATALOG-002, NFR-SEC-015. Task: T-CATALOG-002.
 *
 * "Unknown genre slug ignored (not error)" splits across two modules and both
 * halves are required:
 * - SHAPE (here): a token that is empty, over-long, or not slug-shaped is
 *   dropped. It cannot match a `genre` row, so filtering on it is a no-op.
 * - EXISTENCE (the repository, which owns the `manga_genre`/`genre` join): a
 *   well-shaped slug with no `genre` row is likewise a no-op.
 *
 * Neither half ever raises, because a client sending a stale or invented genre
 * is a normal event on a public catalog, not an error condition.
 */
export function normaliseGenreSlug(raw: string): string | null {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  if (slug.length === 0 || slug.length > CATALOG_MAX_GENRE_SLUG_LENGTH) return null;
  return GENRE_SLUG_PATTERN.test(slug) ? slug : null;
}

export type { CallerContext } from '../../shared/contracts';
