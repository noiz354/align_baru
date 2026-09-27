/**
 * `GET /api/v1/catalog/facets` — the public genre/tag vocabulary.
 *
 * Requirements: FR-CATALOG-002 (the filter's vocabulary), FR-SEARCH-003.
 * Tasks: T-CATALOG-002 (this endpoint + `CatalogService.facets`),
 * T-CATALOG-004 (the consumer that renders the filter controls).
 *
 * Body → contract: `{ genres: [{ id, name }], tags: [{ id, name }] }`.
 * Auth: none / public. Idempotent: a pure read, safe to retry.
 * Cache: `private, max-age=60, stale-while-revalidate=60` (API_CONTRACT §1).
 * Failures: `INTERNAL_ERROR` 500 when the vocabulary port is not registered.
 *
 * ── Counts are deliberately absent ───────────────────────────────────────
 * T-CATALOG-002's task text puts counts out of scope, and the port has no
 * `count` in it for the same reason: a count per genre is an aggregate over the
 * whole `manga_genre` join on a public endpoint, which is a different query
 * with a different index story. A task that wants counts adds them there.
 *
 * The vocabulary is narrowed to genres/tags that at least one VISIBLE manga
 * carries, because a control that can only ever return zero results is not a
 * filter. A genre whose only holder is an unpublished title is therefore not
 * offered — and the integration suite proves both halves (that it is absent,
 * and that every offered genre does filter to something).
 */
import { AppError } from '../../../../../shared/contracts/errors';
import {
  CATALOG_CACHE_CONTROL,
  SILENT_LOGGER,
  failureResponse,
  jsonResponse,
  requestIdOf,
} from '../../_http';
import type { ApiV1Deps } from '../../_deps';
import { apiV1DepsForRequest } from '../../_runtime';
import { catalogFacetsQuerySchema, parseQuery, stringBag } from '../../_query';

/** Never prerendered: it reads the database. */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE. */
const ROUTE = '/api/v1/catalog/facets';

/**
 * Builds the request handler over its dependencies.
 *
 * @param deps the catalog service, the caller resolver and the logger
 * @returns the `GET` handler
 */
export function createCatalogFacetsHandler(
  deps: ApiV1Deps,
): (request: Request) => Promise<Response> {
  return async function GET(request: Request): Promise<Response> {
    const requestId = requestIdOf(request);
    try {
      // Parsed for the same reason as every other route: an unknown query
      // parameter is dropped rather than forwarded, so a client cannot pass a
      // flag this endpoint has not decided about.
      parseQuery(catalogFacetsQuerySchema, stringBag(new URL(request.url)));
      const facets = await deps.catalog.facets();
      return jsonResponse(facets, { status: 200, requestId, cacheControl: CATALOG_CACHE_CONTROL });
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/** The Next.js entry point; see `catalog/route.ts` for the registry rationale. */
export async function GET(request: Request): Promise<Response> {
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
  return createCatalogFacetsHandler(deps)(request);
}
