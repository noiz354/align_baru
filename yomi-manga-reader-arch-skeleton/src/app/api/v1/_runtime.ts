/**
 * The `/api/v1` runtime adapter — the one module that joins the composition
 * root to the `/api/v1` dependency seam.
 *
 * Why it exists: `_deps.ts` must not import infrastructure (rule D6 — it exists
 * precisely so a route never constructs infrastructure), and
 * `server/composition.ts` must not know about an app-layer seam (the dependency
 * runs server ← app). This file is the joint: it is an `app/api` module, so it
 * may import the composition root, and it hands the result to the seam as data.
 *
 * Requirements: module-boundaries.md §2, dependency-rules.md §3.
 * Tasks: T-CATALOG-002, T-CATALOG-006, T-CATALOG-007.
 */
import { createCatalogComposition } from '../../../server/composition';
import { resolveCallerContext } from '../../../server/auth/guard';
import { apiV1DepsWith, type ApiV1Deps } from './_deps';
import type { CallerContext } from '../../../shared/contracts';

/**
 * The caller resolver for `/api/v1`.
 *
 * REAL, and it was not. This function used to answer `null` unconditionally, on
 * the reasoning that every `/api/v1` endpoint wired so far is public
 * (`/api/v1/catalog`, `/api/v1/catalog/facets`, `/api/v1/manga/{slug}`,
 * `/api/v1/manga/{slug}/chapters` are all anonymous-allowed per API_CONTRACT
 * §2.1). That reasoning was half right, and the half that was wrong was expensive:
 * `CatalogService.detail` treats a null caller as "no position to offer" and
 * omits `continueReading` (FR-CATALOG-008), so the "Continue Ch.12 p.45" button
 * on every manga detail page was dead code that always rendered "Read Chapter 1".
 * A signed-in reader with real saved progress was told they had read nothing.
 *
 * It was invisible to the suite because every catalog test injects
 * `resolveCaller: async () => null` — the injected resolver satisfied the seam's
 * type, and the production one was never called. The seam declares
 * `(request: Request) => Promise<CallerContext>`; the stub was a zero-argument
 * `Promise<null>`, which TypeScript accepts, because a function that ignores all
 * its parameters is assignable to any function type.
 *
 * It delegates to `resolveCallerContext` rather than re-reading the session, so
 * `/api` and `/api/v1` cannot drift into granting different authority from the
 * same cookie — see `server/auth/guard.ts` for why that rule lives in one place.
 *
 * It reads the session cookie and nothing else. There is no path here by which a
 * header, a query parameter or a body field names the acting user
 * (API_CONTRACT §1 input identity rule, THREAT T-04).
 *
 * Requirements: API_CONTRACT §1/§2.1, FR-CATALOG-008, THREAT T-04.
 * Task: T-AUTH-007, T-CATALOG-009 (owner of the full session authority, F-002).
 */
export function resolveCaller(request: Request): Promise<CallerContext> {
  return resolveCallerContext(request);
}

/**
 * Builds the real `/api/v1` dependencies, once per process.
 *
 * Memoisation (and the no-cache-on-failure rule) belongs to
 * {@link apiV1DepsWith}; this only supplies the factory.
 */
async function buildApiV1Deps(): Promise<ApiV1Deps> {
  const { catalog, chapters, search, logger } = await createCatalogComposition();
  return { catalog, chapters, search, resolveCaller, logger };
}

/**
 * The dependencies a request runs on.
 *
 * @returns the wired deps, or the composition's rejection — which a route logs
 *   with its real cause rather than answering "not wired"
 * @throws {ConfigurationError | DatabaseConfigurationError} when boot fails
 */
export function apiV1DepsForRequest(): Promise<ApiV1Deps | null> {
  return apiV1DepsWith(buildApiV1Deps);
}
