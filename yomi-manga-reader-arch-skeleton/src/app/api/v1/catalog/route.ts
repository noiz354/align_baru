/**
 * `GET /api/v1/catalog` — the paginated, filterable, sortable public catalog.
 *
 * Requirements: FR-CATALOG-001…005, NFR-PERF-004, NFR-SEC-015.
 * Tasks: T-CATALOG-002 (this route + the service behind it), T-CATALOG-003
 * (the page that calls it).
 * Body → contract: API_CONTRACT §2.1 → `{ items: MangaSummary[], nextCursor }`.
 *
 * Auth: none / public (no session is read, so no identity can influence it).
 * Cache: `private, max-age=60, stale-while-revalidate=60` (API_CONTRACT §1).
 * Failures: `VALIDATION_BAD_QUERY` 422 (bad sort/status/sixth genre),
 * `CATALOG_PAGE_INVALID` 422 (bad cursor/limit), `INTERNAL_ERROR` 500.
 * Idempotent: a pure read, safe to retry.
 *
 * ── Rate limiting is NOT here (documented, not silently skipped) ─────────
 * §2.1 states "generic 300/min/IP" and NFR-SEC-006 owns enforcement for the
 * whole API. No rate-limit middleware, store or `Guard` exists yet (T-SEC-*),
 * and this route is not the place to introduce one: a per-route limiter is
 * invisible to the generic budget and would read as enforced while it is not.
 * Recorded as owned by T-SEC-*, to be applied at the same layer for every
 * route.
 *
 * ── Why a factory + a registry-backed `GET` ───────────────────────────────
 * See `_deps.ts`. The handler body below is the whole request; everything it
 * needs arrives in the argument, so the test drives the real code with no
 * module-level state, and the exported `GET` picks the same body up from the
 * composition root's registration.
 */
import { AppError } from '../../../../shared/contracts/errors';
import {
  CATALOG_CACHE_CONTROL,
  SILENT_LOGGER,
  failureResponse,
  jsonResponse,
  requestIdOf,
} from '../_http';
import type { ApiV1Deps } from '../_deps';
import { apiV1DepsForRequest } from '../_runtime';
import { catalogQuerySchema, parseQuery, stringBag } from '../_query';

/**
 * Never cached and never prerendered: the answer depends on the query string,
 * the database, and the moment. A prerendered artifact would serve one
 * catalog to every query and is the opposite of a live read.
 */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE, never a route with an id in it. */
const ROUTE = '/api/v1/catalog';

/**
 * Builds the request handler over its dependencies.
 *
 * @param deps the catalog service, the caller resolver and the logger
 * @returns the `GET` handler
 */
export function createCatalogListHandler(deps: ApiV1Deps): (request: Request) => Promise<Response> {
  return async function GET(request: Request): Promise<Response> {
    const requestId = requestIdOf(request);
    try {
      const query = parseQuery(catalogQuerySchema, stringBag(new URL(request.url)));
      const page = await deps.catalog.list(query);
      return jsonResponse(page, { status: 200, requestId, cacheControl: CATALOG_CACHE_CONTROL });
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/**
 * The Next.js entry point. Resolves the composition root's registration and
 * answers 500 if the wiring has not happened yet — which is a visible, logged
 * failure rather than an empty catalog that looks like a healthy one.
 */
export async function GET(request: Request): Promise<Response> {
  const deps = await apiV1DepsForRequest();
  if (deps === null) {
    // The composition root that owns the real logger has not run, so this
    // failure has no logger to report to (see SILENT_LOGGER). It says so in its
    // own 500 body instead.
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api/v1 dependencies registered by the composition root'),
      }),
      requestIdOf(request),
      SILENT_LOGGER,
      ROUTE,
    );
  }
  return createCatalogListHandler(deps)(request);
}
