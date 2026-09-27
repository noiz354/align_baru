/**
 * `GET /api/v1/manga/{slug}` — one manga, in full.
 *
 * Requirements: FR-CATALOG-006, FR-CATALOG-008, NFR-PERF-004, NFR-SEC-015.
 * Tasks: T-CATALOG-011 (this route), T-CATALOG-006 (the page that calls it).
 * Body → contract: API_CONTRACT §2.1 → `MangaDetail`.
 *
 * Why this route exists at all, since the data layer already could answer:
 * API_CONTRACT §2.1 lists it and maps it to the Detail page, and
 * `src/app/discover/catalog-data.ts:readMangaDetail` fetches exactly this path.
 * Without the route, every detail page fell through to its "unavailable"
 * branch — a state that reads as a broken deployment rather than as a missing
 * title, and one that no unit test could have caught because the RSC layer was
 * the only thing asking.
 *
 * Auth: none / public. `continueReading` (FR-CATALOG-008) is an authenticated
 * field and is OMITTED here for every caller — see `CatalogService.detail`.
 * Cache: `private, max-age=60, stale-while-revalidate=60` (API_CONTRACT §1).
 * Failures: `MANGA_NOT_FOUND` 404 (unknown, unpublished or soft-deleted — the
 * three are indistinguishable on purpose, §1 no-existence-leak),
 * `VALIDATION_BAD_QUERY` 422 (a slug over the 190-char ceiling), `INTERNAL_ERROR`
 * 500.
 * Idempotent: a pure read, safe to retry.
 *
 * ── The identity rule ────────────────────────────────────────────────────
 * The caller comes from `deps.resolveCaller(request)` — the verified session —
 * and from NOTHING else. There is no `?role=`, no `?userId`, and no path segment
 * that could stand in for one (API_CONTRACT §1 input identity rule, THREAT T-04).
 *
 * ── Rate limiting is NOT here ─────────────────────────────────────────────
 * §2.1's "generic 300/min/IP" is owned by NFR-SEC-006 for the whole API and no
 * rate-limit middleware exists yet (T-SEC-*). A per-route limiter would be
 * invisible to the generic budget and would read as enforced while it is not —
 * the same reasoning, and the same ownership, as `catalog/route.ts`.
 */
import { AppError } from '../../../../../shared/contracts/errors';
import type { MangaSlug } from '../../../../../shared/types';
import {
  CATALOG_CACHE_CONTROL,
  SILENT_LOGGER,
  failureResponse,
  jsonResponse,
  requestIdOf,
} from '../../_http';
import type { ApiV1Deps } from '../../_deps';
import { apiV1DepsForRequest } from '../../_runtime';
import { mangaDetailQuerySchema, parseQuery } from '../../_query';

/** Never prerendered: it reads the database, per slug. */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE, with `{slug}` and no real id. */
const ROUTE = '/api/v1/manga/{slug}';

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
export function createMangaDetailHandler(
  deps: ApiV1Deps,
): (request: Request, context: RouteContext) => Promise<Response> {
  return async function GET(request: Request, context: RouteContext): Promise<Response> {
    const requestId = requestIdOf(request);
    try {
      const { slug } = parseQuery(mangaDetailQuerySchema, await context.params);
      // The ONLY identity source (THREAT T-04).
      const caller = await deps.resolveCaller(request);
      const detail = await deps.catalog.detail(slug as MangaSlug, caller);
      // `null` means unknown, unpublished or soft-deleted — one answer, on
      // purpose. The page turns it into the real 404 page.
      if (detail === null) throw new AppError('MANGA_NOT_FOUND');
      return jsonResponse(detail, { status: 200, requestId, cacheControl: CATALOG_CACHE_CONTROL });
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
  return createMangaDetailHandler(deps)(request, context);
}
