/**
 * The catalog pages' data access — a typed query layer owned by the UI lane.
 *
 * Requirements: FR-CATALOG-001…007, NFR-SEC-010, NFR-PERF-004/008.
 * Tasks: T-CATALOG-003 (list), T-CATALOG-004 (facets), T-CATALOG-006 (detail),
 * T-CATALOG-008 (chapter list).
 * Spec: API_CONTRACT §2.1 — these pages are named there as the CALLER of all
 * four operations.
 *
 * ── Why this layer exists at all ──────────────────────────────────────────
 * The route handlers under `src/app/api/**` belong to the API lane and the
 * repositories to the data lane; this lane owns neither (boundary rule D6 is
 * lint-enforced — nothing under `src/app/**` may import drizzle-orm or the
 * postgres driver). What the UI does own is the SHAPE it reads: the contract is
 * parsed once, with Zod, in ./catalog-schema, and every page receives either a
 * value it can trust or an honest failure it can render. No SQL, no repository
 * import, no fixture, no hardcoded product data (AGENTS.md §4.3).
 *
 * ── Same-origin, absolute URL ─────────────────────────────────────────────
 * A React Server Component has no origin and `fetch('/api/…')` is not a valid
 * URL in Node, so the origin is reconstructed from the request headers. `Host`
 * is the app's own public address in every deployment that serves the app and
 * its API from one origin, which is what a self-hosted reader is
 * (API_CONTRACT §1: "Base: /api/v1"). The contract's cache headers
 * (`private, max-age=60, stale-while-revalidate=60`) are for the browser; this
 * server read is `no-store`, because PERFORMANCE.md §7 records the deliberate
 * decision that v1 has NO server-side application cache.
 *
 * SPEC-QUESTION: an app mounted under a reverse-proxy sub-path (`APP_BASE_PATH`,
 * DEPLOYMENT.md §3) would need that prefix re-applied to the API URL; the
 * header pair alone does not carry it. The correct owner is the deployment /
 * composition task, which is where `basePath` is configured — recorded here
 * rather than guessed at in a page.
 *
 * ── Failure is a value, not a throw ───────────────────────────────────────
 * A 404 is a different page (the real not-found page, never a blank); anything
 * else is a state the page renders and a reader can act on
 * (ACCESSIBILITY.md §6). So this layer returns a discriminated result and never
 * throws: a catalog page that cannot reach its own API is a page with a
 * labelled message on it, not a 500. No new `AppError` code is invented, so
 * API_CONTRACT §6 is untouched (AGENTS.md §4.7).
 * TODO(T-OBS-001): the shared logger facade owns the server-side record of a
 * failed read; nothing under `src/app/**` may log yet, and printing upstream
 * detail to the browser is exactly what NFR-SEC-010 forbids.
 */
import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import type {
  ChapterSummary,
  MangaDetail,
  MangaSummary,
} from '../../shared/contracts';
import {
  catalogPageSchema,
  chapterListSchema,
  facetsFrom,
  facetsSchema,
  mangaDetailSchema,
  type GenreFacet,
} from './catalog-schema';
import { catalogApiQuery, CATALOG_PAGE_SIZE, type CatalogView } from './catalog-query';

/** How long a server-side read may take before the page renders its own state. */
const READ_TIMEOUT_MS = 5_000;

/** Why a read did not produce data — the page maps each to a distinct state. */
export type ReadFailure =
  /** The resource does not exist, or must not be seen (API_CONTRACT §1). */
  | 'not-found'
  /** Upstream refused, timed out, or answered something unusable. */
  | 'unavailable';

export type ReadResult<T> = { ok: true; data: T } | { ok: false; failure: ReadFailure };

/** This app's own public origin, from the incoming request. */
async function apiOrigin(): Promise<string | null> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
    if (host === null || host === '') return null;
    // Only a loopback host is assumed to be plain http. Everything else is
    // https: guessing "http" for a public host would be the unsafe direction.
    const isLoopback = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host);
    const proto = requestHeaders.get('x-forwarded-proto') ?? (isLoopback ? 'http' : 'https');
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

async function readJson(
  origin: string,
  path: string,
  /**
   * Whether a 404 is the answer or the fault.
   *
   * For a RESOURCE (`/manga/{slug}`) a 404 is a real answer: the title is
   * unknown, unpublished or soft-deleted, and the page must render the 404 page.
   * For a COLLECTION (`/api/v1/catalog`, `/facets`) or a sub-resource of a
   * title already known to exist, a 404 means the route is not deployed — an
   * unavailable API, not a missing title. Reading it as "not found" would send
   * a perfectly good catalog to the 404 page and hide a deployment fault behind
   * a plausible-looking state.
   */
  notFoundIsAnswer: boolean,
): Promise<ReadResult<unknown>> {
  try {
    const response = await fetch(new URL(path, origin), {
      // PERFORMANCE.md §7: v1 has no server-side application cache. The API's own
      // `private, max-age=60` header is the browser's, not this read's.
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (response.status === 404 && notFoundIsAnswer) {
      return { ok: false, failure: 'not-found' };
    }
    if (!response.ok) return { ok: false, failure: 'unavailable' };
    return { ok: true, data: await response.json() };
  } catch {
    // A refused connection, a timeout, or a body that is not JSON: one state to
    // a reader, and one state to the page.
    return { ok: false, failure: 'unavailable' };
  }
}

/** One page of the catalog, in the view's filters and sort. */
export const readCatalogPage = cache(
  async (view: CatalogView, limit: number = CATALOG_PAGE_SIZE): Promise<ReadResult<CatalogPage>> => {
    const origin = await apiOrigin();
    if (origin === null) return { ok: false, failure: 'unavailable' };
    const result = await readJson(origin, catalogApiQuery(view, { limit }), false);
    if (!result.ok) return result;
    const parsed = catalogPageSchema.safeParse(result.data);
    if (!parsed.success) return { ok: false, failure: 'unavailable' };
    return {
      ok: true,
      data: { items: parsed.data.items, nextCursor: parsed.data.nextCursor },
    };
  },
);

/** The genre vocabulary for the filter. Its failure is the filter's own state. */
export const readGenreFacets = cache(async (): Promise<ReadResult<GenreFacet[]>> => {
  const origin = await apiOrigin();
  if (origin === null) return { ok: false, failure: 'unavailable' };
  const result = await readJson(origin, '/api/v1/catalog/facets', false);
  if (!result.ok) return result;
  const parsed = facetsSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, failure: 'unavailable' };
  return { ok: true, data: facetsFrom(parsed.data) };
});

/** One manga, or `not-found` for unpublished / soft-deleted (API_CONTRACT §1). */
export const readMangaDetail = cache(async (slug: string): Promise<ReadResult<MangaDetail>> => {
  const origin = await apiOrigin();
  if (origin === null) return { ok: false, failure: 'unavailable' };
  const result = await readJson(origin, `/api/v1/manga/${encodeURIComponent(slug)}`, true);
  if (!result.ok) return result;
  const parsed = mangaDetailSchema.safeParse(result.data);
  if (!parsed.success) return { ok: false, failure: 'unavailable' };
  return { ok: true, data: parsed.data };
});

/** The chapter list in reading order (API_CONTRACT §2.1 — no cursor, ≤ 1000). */
export const readChapterList = cache(
  async (slug: string): Promise<ReadResult<readonly ChapterSummary[]>> => {
    const origin = await apiOrigin();
    if (origin === null) return { ok: false, failure: 'unavailable' };
    const result = await readJson(
      origin,
      `/api/v1/manga/${encodeURIComponent(slug)}/chapters`,
      false,
    );
    if (!result.ok) return result;
    const parsed = chapterListSchema.safeParse(result.data);
    if (!parsed.success) return { ok: false, failure: 'unavailable' };
    return { ok: true, data: parsed.data.items };
  },
);

/** What a catalog page renders: one page of summaries, plus the next cursor. */
export interface CatalogPage {
  readonly items: readonly MangaSummary[];
  readonly nextCursor: string | null;
}

export type { GenreFacet };
