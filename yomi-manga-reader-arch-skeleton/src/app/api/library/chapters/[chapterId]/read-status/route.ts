/**
 * `POST /api/library/chapters/{chapterId}/read-status` — mark a chapter read or
 * unread (FR-LIBRARY-007, T-LIB-006, F-008-S1).
 *
 * ── Why this route exists now ───────────────────────────────────────────────
 * `LibraryService.setReadStatus` had been complete, wired to two ports, and called
 * by NOTHING. A service method with no caller is not a feature that is merely
 * unexposed — it is a method whose behaviour nothing has ever observed, and the
 * one place it was exercised (a hand-written call) turned out to be a documented
 * no-op (SQ-LIB-7). The checklist required the zero-caller status to be resolved
 * by wiring it or deleting it; deleting a correct operation would have thrown
 * away the only unset path NFR-DATA-003 requires, so it is wired here.
 *
 * ── Why this route is NOT the auth-deferral violation ───────────────────────
 * The deferral rule is that ADMIN and UPLOAD work must not be exposed before
 * F-005 lands a route guard, because those are unguarded admin surfaces. This is
 * neither: it is the members' `/api` lane, which already ships
 * (`/api/library`, `/api/bookmarks`, `/api/history`) and which enforces
 * membership HERE, per route, exactly as `api/library/[mangaId]/route.ts` does —
 * `resolveCaller` answers `null` without a session and the route answers 401
 * (THREAT T-04). What is still deferred is the `/library` PAGE's control, because
 * pages are what F-005 protects.
 *
 * The acting user is the session's and never the body's (API_CONTRACT §1). The
 * only field the body carries is `read`, and it names an intent, not a person.
 *
 * Requirements: FR-LIBRARY-007, NFR-SEC-002, NFR-SEC-010, THREAT T-04.
 * Tasks: T-LIB-006, T-LIB-007.
 * Body → contract: 204, empty body. Deliberate: this is a command with no reply
 * to make, and a body would invite clients to read state the response would then
 * be a lie about — the progress write that follows is what a client re-reads.
 */
import { AppError } from '../../../../../../shared/contracts/errors';
import { readJsonBody } from '../../../../../../shared/http/request-body';
import { apiDepsForRequest } from '../../../../_runtime';
import type { ApiDeps } from '../../../../_deps';
import { SILENT_LOGGER, failureResponse, requestIdOf } from '../../../../v1/_http';

/** Member data: never prerendered (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/** OBSERVABILITY.md §2.3: the route TEMPLATE, with `{chapterId}` and no real id. */
const ROUTE = '/api/library/chapters/{chapterId}/read-status';

/** API_CONTRACT §1: private data is `no-store`, so a 204 still says so. */
const NO_STORE = 'no-store';

/** Next.js 15+ hands `params` to a handler as a promise. */
interface RouteContext {
  readonly params: Promise<{ chapterId: string }>;
}

interface ReadStatusBody {
  read?: unknown;
}

/**
 * `read` must be a real boolean, and a missing one is NOT `false`.
 *
 * Two failure shapes are refused rather than repaired, for the same reason the
 * reader's `?page=` is: a value this endpoint cannot act on is a client bug worth
 * answering, and a body of `{}` means "the caller sent nothing", which is not the
 * same statement as "mark it unread". `Boolean('false')` is `true`, and
 * `Boolean(0)` is `false`, so coercing would let `"read": 0` silently mark a
 * chapter read.
 */
function parseRead(body: ReadStatusBody): boolean {
  if (typeof body.read !== 'boolean') {
    throw new AppError('VALIDATION_BAD_QUERY', {
      details: [{ path: 'read', message: 'Expected true or false.' }],
    });
  }
  return body.read;
}

/** The handler, as a factory over its dependencies (see the sibling routes). */
export function createSetReadStatusHandler(deps: ApiDeps) {
  return async function POST(request: Request, context: RouteContext): Promise<Response> {
    const requestId = requestIdOf(request);
    // The ONLY identity source (THREAT T-04, API_CONTRACT §1).
    const caller = await deps.resolveCaller(request);
    if (caller === null) {
      return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
    }

    try {
      const body = await readJsonBody<ReadStatusBody>(request).catch(() => undefined);
      if (body === undefined) {
        throw new AppError('VALIDATION_BAD_QUERY', {
          details: [{ path: 'body', message: 'Expected a JSON object.' }],
        });
      }
      const read = parseRead(body);

      // The target from the path, the OWNER from the session — never the other way
      // round. The service checks chapter visibility first, so an unpublished or
      // soft-deleted chapter is a 404 rather than a probe (FR-LIBRARY-007).
      const { chapterId } = await context.params;
      await deps.library.setReadStatus(caller, chapterId, read);

      // Built directly rather than through `jsonResponse`: 204 is defined as
      // having no body, and a JSON constructor cannot promise that — the first
      // version of this route answered 500 on every success for exactly that
      // reason. Same idiom and same reason as `library/[mangaId]/route.ts`.
      return new Response(null, {
        status: 204,
        headers: { 'x-request-id': requestId, 'cache-control': NO_STORE },
      });
    } catch (cause) {
      return failureResponse(
        cause instanceof AppError ? cause : new AppError('INTERNAL_ERROR', { cause }),
        requestId,
        deps.logger,
        ROUTE,
      );
    }
  };
}

/** The Next.js entry point; see `library/[mangaId]/route.ts` for the registry rationale. */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
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
  return createSetReadStatusHandler(deps)(request, context);
}
