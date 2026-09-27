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
import { apiV1DepsWith, type ApiV1Deps } from './_deps';

/**
 * The caller resolver, for as long as auth is T-AUTH-007's to land.
 *
 * It answers `null` — anonymous — which is the contract's answer for every
 * endpoint wired so far (`/api/v1/catalog`, `/api/v1/catalog/facets`,
 * `/api/v1/manga/{slug}`, `/api/v1/manga/{slug}/chapters` are all public,
 * API_CONTRACT §2.1) and the safe default the seam documents.
 *
 * This is NOT a stand-in for a session: it reads no cookie and trusts no
 * header, so it cannot be talked into a role. When T-AUTH-007 lands it
 * replaces this function and nothing else changes — the routes already take the
 * caller from here and from nowhere else (THREAT T-04).
 *
 * Requirements: API_CONTRACT §1 (input identity rule), THREAT T-04.
 * Task: T-AUTH-007 (owner of the real implementation).
 */
export function resolveCaller(): Promise<null> {
  return Promise.resolve(null);
}

/**
 * Builds the real `/api/v1` dependencies, once per process.
 *
 * Memoisation (and the no-cache-on-failure rule) belongs to
 * {@link apiV1DepsWith}; this only supplies the factory.
 */
async function buildApiV1Deps(): Promise<ApiV1Deps> {
  const { catalog, logger } = await createCatalogComposition();
  return { catalog, resolveCaller, logger };
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
