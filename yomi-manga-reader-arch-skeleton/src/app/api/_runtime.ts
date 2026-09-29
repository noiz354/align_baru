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
import { resolveCallerContext } from '../../server/auth/guard';
import { apiDepsWith, type ApiDeps } from './_deps';
import type { CallerContext } from '../../shared/contracts';

/**
 * The caller resolver for the members' surface.
 *
 * `/api/library`, `/api/bookmarks` and `/api/history` are member-only
 * (THREAT T-04), so a resolver that answered `null` would turn every one of them
 * into a 401 and the pages into empty states.
 *
 * It delegates to `resolveCallerContext`, which reads the session cookie and
 * narrows the verified row. The narrowing used to be written out inline here, and
 * the same rule was then written out again in the `/api/v1` seam — where it had
 * drifted to `Promise<null>` and silently cost every signed-in reader their
 * "continue reading" position (F-009-S1). One rule, one place.
 *
 * ── The cost, stated rather than hidden ─────────────────────────────────────
 * The guard acquires the process-wide pool only when a token is actually present,
 * so an anonymous request never touches it from this path. F-002 replaces the
 * guard's body with a `SessionRepository` lookup, at which point this becomes a
 * repository call and stops being a pool question at all.
 *
 * Requirements: API_CONTRACT §1 (input identity rule), THREAT T-04.
 * Task: T-AUTH-007, T-LIB-001 (owner of the full session authority, F-002).
 */
export function resolveCaller(request: Request): Promise<CallerContext> {
  return resolveCallerContext(request);
}

/**
 * Builds the real `/api` dependencies, once per process.
 *
 * Memoisation (and the no-cache-on-failure rule) belongs to {@link apiDepsWith};
 * this only supplies the factory.
 */
async function buildApiDeps(): Promise<ApiDeps> {
  const { library, history, readerProgress, manga, chapters, preferences, logger } =
    await createLibraryComposition();
  return { library, history, readerProgress, manga, chapters, preferences, resolveCaller, logger };
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
