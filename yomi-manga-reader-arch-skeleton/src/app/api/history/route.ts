/**
 * `GET /api/history` — the session user's reading history, newest first.
 *
 * ── Why this file is new ─────────────────────────────────────────────────────
 * `API_CONTRACT.md` §2.3 specifies it, `createHistoryRepository` implements it
 * (`server/db/repositories/history.repository.ts`), and the composition root
 * registers it as `history` (`server/composition.ts`) — but no route reached it,
 * which is why `/history` renders a not-built state: the one line of HTTP the page
 * was waiting for did not exist. This is that line.
 *
 * ── Why it goes through the seam and not a repository ────────────────────────
 * `HistoryRepository.list` is a PORT in `features/progress`, not infrastructure,
 * so calling it is not a boundary violation — but a page or a route that imports
 * it directly is outside the composition the `/api` and `/api/v1` trees share,
 * and would skip the caller resolution and the response envelope the other
 * members' routes all have. Same seam, same shape, no SQL.
 *
 * Requirements: FR-LIBRARY-008, FR-READER-015, NFR-SEC-002, NFR-DATA-005/006,
 * THREAT T-04.
 * Tasks: T-READER-025 (this route), T-LIB-005 (the page it unblocks).
 * Body → contract: API_CONTRACT §2.3 → `HistoryEntry`.
 */
import { AppError } from '../../../shared/contracts/errors';
import { apiDepsForRequest } from '../_runtime';
import type { ApiDeps } from '../_deps';
import { SILENT_LOGGER, failureResponse, jsonResponse, requestIdOf } from '../v1/_http';

const ROUTE = '/api/history';

/** Member data: never prerendered (PERFORMANCE.md §7). */
export const dynamic = 'force-dynamic';

/**
 * API_CONTRACT §1: private data is `no-store`. Written locally for the same
 * reason as in `api/library/route.ts`: `v1/_http.ts` is not this task's file.
 */
const NO_STORE = 'no-store';

/**
 * The list handler, as a factory over its dependencies.
 *
 * Statuses:
 *   - 401 `AUTH_REQUIRED` — no session caller (members-only, THREAT T-04).
 *   - 200 `{ items: HistoryEntry[], nextCursor }` — `items` may be empty (no
 *     reading yet), which is a real answer. `items` is the repository's
 *     `HistoryEntry[]` passed through UNCHANGED: a session whose chapter is gone
 *     keeps its row and carries `chapter: null` (DATA_MODEL §13/§14,
 *     NFR-DATA-005), and `endedAt: null` is an OPEN session rather than a missing
 *     field. Reshaping either here would be the route inventing a second version
 *     of the DTO (`shared/contracts/library.ts`).
 *   - 422 `CATALOG_PAGE_INVALID` — a cursor this list cannot read; the repository
 *     rejects rather than repairs a malformed one.
 *   - 500 `INTERNAL_ERROR` — an unhandled failure, logged with its cause and
 *     answered with the generic §6 body (NFR-SEC-010).
 *
 * ── The caller, and the one place it is not re-checked ───────────────────────
 * Unlike `LibraryService`, this port takes a `UserId`, not a `Caller` — it is a
 * repository, and it has no session of its own to consult. So the 401 is decided
 * HERE, at the HTTP edge, and `caller.userId` is the only value passed down. That
 * value came from the verified session and from nowhere else
 * (API_CONTRACT §1 input identity rule, THREAT T-04).
 *
 * @param deps the wired members' services
 * @returns the `GET` handler
 */
export function createHistoryListHandler(deps: ApiDeps) {
  return async function GET(request: Request): Promise<Response> {
    const requestId = requestIdOf(request);
    const caller = await deps.resolveCaller(request);
    if (caller === null) {
      return failureResponse(new AppError('AUTH_REQUIRED'), requestId, deps.logger, ROUTE);
    }

    try {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      const limitRaw = url.searchParams.get('limit');
      const limit = limitRaw === null ? undefined : Number.parseInt(limitRaw, 10);
      const page = await deps.history.list(caller.userId, {
        ...(cursor === null ? {} : { cursor }),
        // Passed through only when it PARSED, because a repository that indexed
        // `query.limit` would throw a bare TypeError — a 500 — for a `NaN`. The
        // clamp is the repository's own (48), so this edge keeps no second copy.
        ...(limit === undefined || Number.isNaN(limit) ? {} : { limit }),
      });

      return jsonResponse(
        { items: page.items, nextCursor: page.nextCursor },
        { status: 200, requestId, cacheControl: NO_STORE },
      );
    } catch (error) {
      return failureResponse(error, requestId, deps.logger, ROUTE);
    }
  };
}

/** The Next.js entry point; see `api/library/route.ts` for the registry rationale. */
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
  return createHistoryListHandler(deps)(request);
}
