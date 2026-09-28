/**
 * The unversioned `/api` runtime adapter — the one module that joins the
 * composition root to the `/api` dependency seam.
 *
 * Why it exists: `_deps.ts` must not import infrastructure (rule D6 — it exists
 * precisely so a route never constructs infrastructure), and
 * `server/composition.ts` must not know about an app-layer seam (the dependency
 * runs server ← app). This file is the joint: it is an `app/api` module, so it may
 * import the composition root, and it hands the result to the seam as data.
 *
 * Requirements: module-boundaries.md §2, dependency-rules.md §3.
 * Tasks: T-LIB-001, T-LIB-007, T-READER-025.
 */
import { createLibraryComposition } from '../../server/composition';
import { getSessionUser } from '../../server/auth/guard';
import { apiDepsWith, type ApiDeps } from './_deps';
import type { CallerContext } from '../../shared/contracts';
import type { UserId } from '../../shared/types';

/**
 * The caller resolver, for the members' surface.
 *
 * Unlike the `/api/v1` seam's, this one is REAL: `/api/library`, `/api/bookmarks`
 * and `/api/history` are member-only (THREAT T-04), so a resolver that answered
 * `null` would turn every one of them into a 401 and the pages into empty states.
 * `getSessionUser` reads the session cookie and returns the verified row.
 *
 * ── The cost, stated rather than hidden ─────────────────────────────────────
 * `getSessionUser` opens its own database handle per request (guard.ts), so a
 * members' route currently holds two connections: this one and the composition's.
 * That is the pre-existing behaviour of every route this seam replaces — not a
 * regression — and it is T-AUTH-007's job to fold the guard onto the composition's
 * handle. Until then this seam is correct and slightly wasteful; after T-AUTH-007
 * it is correct and not.
 *
 * Requirements: API_CONTRACT §1 (input identity rule), THREAT T-04.
 * Task: T-AUTH-007 (owner of removing the second connection).
 */
export async function resolveCaller(request: Request): Promise<CallerContext> {
  const user = await getSessionUser(request);
  if (user === null) return null;
  // Narrowed, not cast. The role arrives as a `string` from the row and the
  // services require the `UserRole` union; the `users_role` CHECK constrains the
  // column to the two members, but a check is a database promise and this is the
  // place that either honours it or admits it was wrong. An unrecognised role
  // answers `null` — anonymous — so an unexpected value can never widen a
  // caller's authority on the way in.
  if (user.role === 'reader' || user.role === 'admin') {
    return { userId: user.id as UserId, role: user.role };
  }
  return null;
}

/**
 * Builds the real `/api` dependencies, once per process.
 *
 * Memoisation (and the no-cache-on-failure rule) belongs to {@link apiDepsWith};
 * this only supplies the factory.
 */
async function buildApiDeps(): Promise<ApiDeps> {
  const { library, history, readerProgress, manga, chapters, logger } =
    await createLibraryComposition();
  return { library, history, readerProgress, manga, chapters, resolveCaller, logger };
}

/**
 * The dependencies a request runs on.
 *
 * @returns the wired deps, or the composition's rejection — which a route logs
 *   with its real cause rather than answering "not wired"
 * @throws {ConfigurationError | DatabaseConfigurationError} when boot fails
 */
export function apiDepsForRequest(): Promise<ApiDeps | null> {
  return apiDepsWith(buildApiDeps);
}
