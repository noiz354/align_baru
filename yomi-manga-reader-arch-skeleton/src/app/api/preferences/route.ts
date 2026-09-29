/**
 * `GET` / `PUT /api/preferences` — the caller's own reader preferences
 * (F-013-S1/S2).
 *
 * ── Why this route is safe to ship while the guard is deferred ─────────────
 * It is SELF-SCOPED: every operation touches the caller's OWN `user_id` row
 * and nothing else, resolved from the session by `deps.resolveCaller`. There
 * is no id in the path, no user in the body, and no admin branch — so there is
 * nothing here a missing route guard could expose. Compare the admin routes,
 * which must NOT exist until F-005: those act on OTHER rows, which is the
 * whole of the difference. A reader's preferences are not anyone else's
 * business, and there is no admin view of them by design.
 *
 * - `GET` answers the stored row, or the documented defaults when no row
 *   exists yet (200 either way — "never opened settings" is not an error).
 * - `PUT` takes a partial object, validates field by field, and upserts. A
 *   body that is not an object, or a field with the wrong shape, is 422 with
 *   the field named.
 * - No session is 401 on both methods. Anonymous preferences would be
 *   device-local state pretending to be an account; the reader keeps
 *   device-local behaviour client-side instead.
 *
 * Requirements: FR-READER-xxx (preferences), API_CONTRACT §1, THREAT T-04.
 * Tasks: F-013-S1/S2.
 */
import { AppError } from '../../../shared/contracts/errors';
import { readJsonBody } from '../../../shared/http/request-body';
import { apiDepsForRequest } from '../_runtime';
import type { ApiDeps } from '../_deps';
import { SILENT_LOGGER, failureResponse, jsonResponse, requestIdOf } from '../v1/_http';

/** Member data: never prerendered (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route template. */
const ROUTE = '/api/preferences';

/** API_CONTRACT §1: private data is `no-store`. */
const NO_STORE = 'no-store';

/** The handler, as a factory over its dependencies (see the sibling routes). */
export function createPreferencesHandler(deps: ApiDeps) {
  return {
    async GET(request: Request): Promise<Response> {
      const requestId = requestIdOf(request);
      // The ONLY identity source (THREAT T-04, API_CONTRACT §1).
      const caller = await deps.resolveCaller(request);
      if (caller === null) {
        return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
      }
      try {
        const preferences = await deps.preferences.get({ userId: caller.userId });
        return jsonResponse(preferences, { status: 200, requestId, cacheControl: NO_STORE });
      } catch (cause) {
        return failureResponse(
          cause instanceof AppError ? cause : new AppError('INTERNAL_ERROR', { cause }),
          requestId,
          deps.logger,
          ROUTE,
        );
      }
    },

    async PUT(request: Request): Promise<Response> {
      const requestId = requestIdOf(request);
      const caller = await deps.resolveCaller(request);
      if (caller === null) {
        return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
      }
      try {
        const body = await readJsonBody<Record<string, unknown>>(request).catch(() => undefined);
        if (
          body === undefined ||
          typeof body !== 'object' ||
          body === null ||
          Array.isArray(body)
        ) {
          throw new AppError('VALIDATION_BAD_QUERY', {
            details: [{ path: 'body', message: 'Expected a JSON object.' }],
          });
        }
        const preferences = await deps.preferences.put({ userId: caller.userId }, body);
        return jsonResponse(preferences, { status: 200, requestId, cacheControl: NO_STORE });
      } catch (cause) {
        return failureResponse(
          cause instanceof AppError ? cause : new AppError('INTERNAL_ERROR', { cause }),
          requestId,
          deps.logger,
          ROUTE,
        );
      }
    },
  };
}

/** The Next.js entry points; see `library/[mangaId]/route.ts` for the registry rationale. */
export async function GET(request: Request): Promise<Response> {
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
  return createPreferencesHandler(deps).GET(request);
}

export async function PUT(request: Request): Promise<Response> {
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
  return createPreferencesHandler(deps).PUT(request);
}
