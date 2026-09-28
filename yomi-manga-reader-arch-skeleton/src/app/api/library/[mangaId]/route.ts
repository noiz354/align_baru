/**
 * `DELETE /api/library/{mangaId}` — take one title off the caller's shelf.
 *
 * ── What this route used to be ───────────────────────────────────────────────
 * It opened its own database (`createDb(loadEnv())`, rule D6), deleted through
 * `server/db/queries/reader-state.ts` and answered `200 { ok: true }` — a body on
 * a delete, and a 200 for a row that may never have existed. It also closed the
 * pool it had just opened on every request, so a shelf of deletes cost a
 * connection each.
 *
 * Now it goes through the seam: `LibraryService.remove` → the `LibraryRepository`,
 * whose `WHERE` carries the owner, so one reader's shelf can never be edited
 * through another's id (THREAT T-04).
 *
 * Requirements: FR-LIBRARY-002, NFR-SEC-002, THREAT T-04.
 * Tasks: T-LIB-001, T-LIB-002.
 * Body → contract: API_CONTRACT §2.4 ("204 on already-absent to keep client logic
 * simple — documented choice").
 */
import { AppError } from '../../../../shared/contracts/errors';
import { apiDepsForRequest } from '../../_runtime';
import type { ApiDeps } from '../../_deps';
import { SILENT_LOGGER, failureResponse, requestIdOf } from '../../v1/_http';

/** Member data: never prerendered (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE, with `{mangaId}` and no real id. */
const ROUTE = '/api/library/{mangaId}';

/**
 * API_CONTRACT §1: private data is `no-store`, so a 204 still says so — a cache
 * that stored "removed" would hide a later re-add behind a stale answer.
 *
 * The same constant is written locally in `api/library/route.ts`,
 * `api/bookmarks/route.ts` and `api/history/route.ts`; its home belongs beside
 * `CATALOG_CACHE_CONTROL` in `v1/_http.ts`, which this task does not own.
 */
const NO_STORE = 'no-store';

/** Next.js 15+ hands `params` to a handler as a promise. */
interface RouteContext {
  readonly params: Promise<{ mangaId: string }>;
}

/**
 * The handler, as a factory over its dependencies, so a test can call it with no
 * global state and no database.
 *
 * Statuses:
 *   - 401 `AUTH_REQUIRED` — no session caller (members-only, THREAT T-04).
 *   - 204, empty body — removed, OR not on the shelf (FR-LIBRARY-002 and
 *     API_CONTRACT §2.4: the two are deliberately the same answer, so a client
 *     can treat "remove" as idempotent and a probe cannot learn whether another
 *     reader has this title).
 *   - 500 `INTERNAL_ERROR` — an unhandled failure, logged with its cause and
 *     answered with the generic §6 body (NFR-SEC-010).
 *
 * @param deps the wired members' services
 * @returns the `DELETE` handler
 */
export function createLibraryRemoveHandler(deps: ApiDeps) {
  return async function DELETE(request: Request, context: RouteContext): Promise<Response> {
    const requestId = requestIdOf(request);
    const caller = await deps.resolveCaller(request);
    if (caller === null) {
      return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
    }

    try {
      const { mangaId } = await context.params;
      // The target comes from the path, the OWNER from the session — never the
      // other way round (API_CONTRACT §1 input identity rule).
      await deps.library.remove(caller, mangaId);
      // Built directly rather than through `jsonResponse`: 204 is defined as
      // having no body, and a JSON constructor cannot promise that.
      return new Response(null, {
        status: 204,
        headers: { 'x-request-id': requestId, 'cache-control': NO_STORE },
      });
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/** The Next.js entry point; see `api/library/route.ts` for the registry rationale. */
export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const deps = await apiDepsForRequest();
  if (deps === null) {
    return failureResponse(
      new AppError('INTERNAL_ERROR', {
        cause: new Error('no /api dependencies registered by the composition root'),
      }),
      requestIdOf(request),
      SILENT_LOGGER,
      ROUTE,
    );
  }
  return createLibraryRemoveHandler(deps)(request, context);
}
