/**
 * Catalog view state: the URL is the state (T-CATALOG-004/005).
 *
 * Requirements: FR-CATALOG-002/003/004, NFR-A11Y-002.
 * Tasks: T-CATALOG-004 (genre), T-CATALOG-005 (status + sort).
 * Spec: API_CONTRACT §2.1 `GET /api/v1/catalog` input row.
 *
 * ── Why a shareable URL and not component state ───────────────────────────
 * A filter a reader cannot send to someone else is a filter they cannot
 * describe. Every control on `/discover` writes to the query string and the
 * page re-reads it on the server, so `?genre=action,drama&sort=title_asc` is
 * the whole state: refresh keeps it, back works, and two people can look at the
 * same shelf (T-CATALOG-004 expected behavior 1).
 *
 * ── The parsing is TOTAL, by contract ─────────────────────────────────────
 * Everything in the query string is attacker-controlled (a pasted link, a
 * hand-edited URL, a crawler). So `parseCatalogView` never throws and never
 * forwards a value the API contract does not allow:
 *   - `sort` and `status` are whitelists. An unknown value is DROPPED, not
 *     forwarded — the API answers 422 for those, and a 422 on a page load is a
 *     broken page (API_CONTRACT §2.1 Validation; SECURITY T-02).
 *   - `genre` accepts `[a-z0-9-]` slugs only, de-duplicated, capped at
 *     {@link MAX_GENRES} because the contract caps it at 5 and a 6th value is a
 *     422. The UI refuses the 6th with a message instead of sending one.
 *   - An unknown genre slug is NOT an error here either: the API ignores
 *     unknown slugs by contract, so the UI shows what comes back.
 *
 * This module is imported by the page (server) AND by the client islands, so it
 * must stay pure and dependency-free.
 */
import type { MangaStatus } from '../../shared/contracts';

/** API_CONTRACT §2.1: `sort?` (title_asc, updated_desc, added_desc). */
export const CATALOG_SORTS = ['title_asc', 'updated_desc', 'added_desc'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/** API_CONTRACT §2.1 default sort. */
export const DEFAULT_SORT: CatalogSort = 'updated_desc';

/** FR-CATALOG-003 / API_CONTRACT §2.1: `status?`. */
export const MANGA_STATUSES = ['ongoing', 'completed', 'hiatus'] as const;

/** API_CONTRACT §2.1: `genre?` is a csv of at most 5 slugs. */
export const MAX_GENRES = 5;

/** API_CONTRACT §2.1: `limit?` ≤ 48, default 24 (FR-CATALOG-001). */
export const CATALOG_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;

/** A genre slug as it appears in the URL: lowercase, digits, dashes. */
const GENRE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/** The parsed, whitelisted view state the page renders. */
export interface CatalogView {
  /** Selected genre slugs, de-duplicated, in URL order, ≤ {@link MAX_GENRES}. */
  genres: readonly string[];
  status: MangaStatus | null;
  sort: CatalogSort;
}

/** Next's `searchParams` for a page: each key may arrive as an array. */
type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function isSort(value: string): value is CatalogSort {
  return (CATALOG_SORTS as readonly string[]).includes(value);
}

function isStatus(value: string): value is MangaStatus {
  return (MANGA_STATUSES as readonly string[]).includes(value);
}

/**
 * Reads the view state out of a page's `searchParams`. Total: junk in, valid
 * state out, never a throw and never a forwarded value the API would reject.
 */
export function parseCatalogView(params: RawParams): CatalogView {
  const seen = new Set<string>();
  for (const part of single(params['genre']).split(',')) {
    const slug = part.trim().toLowerCase();
    if (slug === '' || !GENRE_SLUG.test(slug)) continue;
    if (seen.has(slug)) continue;
    if (seen.size >= MAX_GENRES) break;
    seen.add(slug);
  }

  const rawStatus = single(params['status']);
  const rawSort = single(params['sort']);

  return {
    genres: [...seen],
    status: isStatus(rawStatus) ? rawStatus : null,
    sort: isSort(rawSort) ? rawSort : DEFAULT_SORT,
  };
}

/** The query string for a view: absent parameters are absent, not empty. */
export function catalogSearchParams(view: Partial<CatalogView>): URLSearchParams {
  const search = new URLSearchParams();
  const genres = (view.genres ?? []).filter((slug) => GENRE_SLUG.test(slug)).slice(0, MAX_GENRES);
  if (genres.length > 0) search.set('genre', genres.join(','));
  if (view.status !== undefined && view.status !== null && isStatus(view.status)) {
    search.set('status', view.status);
  }
  if (view.sort !== undefined && isSort(view.sort) && view.sort !== DEFAULT_SORT) {
    search.set('sort', view.sort);
  }
  return search;
}

/**
 * The query string as it is written into an href.
 *
 * `URLSearchParams` percent-encodes the genre separator, which would put
 * `?genre=action%2Cdrama` in the address bar. Both spellings parse identically
 * (`searchParams.get('genre')` returns `action,drama` either way), but
 * T-CATALOG-004 names the shareable form as `?genre=action,drama`, and an
 * address a reader can read, retype and paste without decoding is the whole
 * point of putting the filter in the URL. So the separator is written literally.
 */
export function catalogQueryString(view: Partial<CatalogView>): string {
  return catalogSearchParams(view).toString().replaceAll('%2C', ',');
}

/** The `/discover` href for a view — the shareable form (T-CATALOG-004). */
export function catalogHref(view: Partial<CatalogView>, base = '/discover'): string {
  const query = catalogQueryString(view);
  return query === '' ? base : `${base}?${query}`;
}

/** The API query for a view: the same state, plus paging (API_CONTRACT §2.1). */
export function catalogApiQuery(
  view: CatalogView,
  paging: { limit: number; cursor?: string | null } = { limit: CATALOG_PAGE_SIZE },
): string {
  const search = catalogSearchParams(view);
  search.set('limit', String(Math.min(Math.max(1, paging.limit), MAX_PAGE_SIZE)));
  if (paging.cursor !== undefined && paging.cursor !== null && paging.cursor !== '') {
    search.set('cursor', paging.cursor);
  }
  // The API reads the same csv the address bar shows, so both spellings travel.
  return `/api/v1/catalog?${search.toString().replaceAll('%2C', ',')}`;
}

/** Human label for a status, used in the select and in card meta. */
export const STATUS_LABEL: Readonly<Record<MangaStatus, string>> = {
  ongoing: 'Ongoing',
  completed: 'Completed',
  hiatus: 'Hiatus',
};

export const SORT_LABEL: Readonly<Record<CatalogSort, string>> = {
  updated_desc: 'Recently updated',
  title_asc: 'Title A–Z',
  added_desc: 'Newly added',
};

/** "Chapter 10.5" — numeric(8,2) means a decimal part is legal (DATA_MODEL §9). */
export function chapterLabel(number: number): string {
  const rounded = Math.round(number * 100) / 100;
  return Number.isInteger(rounded) ? `Chapter ${rounded}` : `Chapter ${String(rounded)}`;
}
