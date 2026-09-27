/**
 * `GET /api/v1/manga/{slug}/chapters` — the chapter list in reading order.
 *
 * Requirements: FR-CATALOG-007, FR-CHAPTER-002/004, NFR-PERF-004.
 * Tasks: T-CATALOG-007 (this route + the service behind it), T-CATALOG-008
 * (the list UI that calls it).
 * Body → contract: API_CONTRACT §2.1 → `{ items: ChapterSummary[] }`, NO
 * cursor, `items: []` for a manga with no chapters.
 *
 * Auth / Authz: public (published only). `includeDrafts` is honoured ONLY for
 * an admin caller — "flag `includeDrafts` honored only for admin role". A
 * non-admin sending it gets the published-only list, never an error and never a
 * draft (FR-CHAPTER-002, FR-CATALOG-007; the draft-leakage proof is
 * INT-CHAP-001 in tests/integration/chapter-list.test.ts).
 *
 * Failures: `MANGA_NOT_FOUND` 404 (unknown, unpublished or soft-deleted — the
 * three are indistinguishable on purpose, API_CONTRACT §1 no-existence-leak),
 * `CHAPTER_LIST_TOO_LARGE` 409 (> 1000 chapters, a data problem that alerts —
 * §6), `VALIDATION_BAD_QUERY` 422 (an over-long slug or an unreadable
 * `includeDrafts`), `INTERNAL_ERROR` 500.
 * Cache: `private, max-age=60, stale-while-revalidate=60` (API_CONTRACT §1).
 * Idempotent: a pure read, safe to retry.
 *
 * ── The identity rule ────────────────────────────────────────────────────
 * The caller comes from `deps.resolveCaller(request)` — the verified session —
 * and from NOTHING else. There is no `?role=`, no `?userId`, and no path
 * segment that could stand in for one (API_CONTRACT §1 input identity rule,
 * THREAT T-04). `includeDrafts` is a request for MORE data, never a claim to
 * be allowed to see it.
 */
import { AppError } from '../../../../../../shared/contracts/errors';
import type { MangaSlug } from '../../../../../../shared/types';
import {
  CATALOG_CACHE_CONTROL,
  SILENT_LOGGER,
  failureResponse,
  jsonResponse,
  requestIdOf,
} from '../../../_http';
import type { ApiV1Deps } from '../../../_deps';
import { apiV1DepsForRequest } from '../../../_runtime';
import { chapterListQuerySchema, parseQuery } from '../../../_query';

/** Never prerendered: it reads the database, per slug. */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE, with `{slug}` and no real id. */
const ROUTE = '/api/v1/manga/{slug}/chapters';

/** Next.js 15+ hands `params` to a handler as a promise. */
interface RouteContext {
  readonly params: Promise<{ slug: string }>;
}

/**
 * Builds the request handler over its dependencies.
 *
 * @param deps the catalog service, the caller resolver and the logger
 * @returns the `GET` handler
 */
export function createChapterListHandler(
  deps: ApiV1Deps,
): (request: Request, context: RouteContext) => Promise<Response> {
  return async function GET(request: Request, context: RouteContext): Promise<Response> {
    const requestId = requestIdOf(request);
    try {
      const params = await context.params;
      const query = parseQuery(chapterListQuerySchema, {
        slug: params.slug,
        ...(new URL(request.url).searchParams.has('includeDrafts')
          ? { includeDrafts: new URL(request.url).searchParams.get('includeDrafts') ?? '' }
          : {}),
      });
      // The ONLY identity source (THREAT T-04).
      const caller = await deps.resolveCaller(request);
      const items = await deps.catalog.chapterList(query.slug as MangaSlug, caller, {
        ...(query.includeDrafts === undefined ? {} : { includeDrafts: query.includeDrafts }),
      });
      if (items === null) throw new AppError('MANGA_NOT_FOUND');
      return jsonResponse(
        { items },
        { status: 200, requestId, cacheControl: CATALOG_CACHE_CONTROL },
      );
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/** The Next.js entry point; see `catalog/route.ts` for the registry rationale. */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const deps = await apiV1DepsForRequest();
  if (deps === null) {
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api/v1 dependencies registered by the composition root'),
      }),
      requestIdOf(request),
      SILENT_LOGGER,
      ROUTE,
    );
  }
  return createChapterListHandler(deps)(request, context);
}
