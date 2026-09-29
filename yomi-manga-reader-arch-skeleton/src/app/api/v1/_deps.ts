/**
 * The `/api/v1` dependency seam (T-CATALOG-002, T-CATALOG-007).
 *
 * Why a seam at all, stated plainly: `server/composition.ts` is the project's
 * documented wiring point ("route handlers (app/api) | composition (services)",
 * dependency-rules.md §3). A route handler that built its own database handle
 * would be a route handler that owns infrastructure (rule D6), and one that
 * called a not-yet-implemented boot entry would be a route handler that 500s.
 *
 * So the handler is written as a FACTORY that takes its dependencies, and the
 * Next.js entry point resolves them from this module-level registry. That gives
 * three things at once:
 * - the handler is fully testable with no global state (the tests call the
 *   factory, so they never touch the registry);
 * - the moment composition registers the deps, the default `GET` works with no
 *   change to the route;
 * - the failure mode before that is honest — a 500 with a log line saying the
 *   wiring is missing, not a silent empty list.
 *
 * ── History: the registry was never populated ──────────────────────────────
 * The first version of this file shipped with `registerApiV1Deps` documented as
 * "called once by the composition root at boot" and with no caller anywhere in
 * `src/`. Every `/api/v1` route therefore answered `INTERNAL_ERROR` 500 on a
 * real server, and the integration suite stayed green because it calls the
 * handler factories directly and registers its own deps — it never took the
 * path a request takes. `apiV1DepsWith` is the fix, and UNIT-CAT-007
 * (tests/unit/api-v1-deps.test.ts) pins it.
 *
 * Rules:
 * - This module holds no infrastructure and imports none (D6): it knows a
 *   `CatalogService`, a caller resolver and a `Logger`, nothing else. The
 *   composition BUILDER is passed in by the caller of `apiV1DepsWith`, never
 *   imported here — otherwise this seam would need the database it exists to
 *   hide.
 * - The caller resolver returns a `CallerContext`, i.e. NULL for an anonymous
 *   request. The public chapter-list endpoint allows anonymous callers, so this
 *   is not the `Guard.requireUser` of T-AUTH-007 — it is the optional-caller
 *   half of it, and `null` is the safe default.
 * - The acting user is ALWAYS whatever the resolver returns from the verified
 *   session and NEVER anything from the query string (API_CONTRACT §1 input
 *   identity rule, THREAT T-04). A route that read `?role=admin` here would be
 *   the vulnerability the rule exists to prevent.
 *
 * Requirements: API_CONTRACT §1/§3, NFR-SEC-002, NFR-OPS-002, THREAT T-04.
 * Tasks: T-CATALOG-002, T-CATALOG-007.
 */
import type { CallerContext } from '../../../shared/contracts';
import type { CatalogService } from '../../../features/catalog';
import type { ChapterRepository } from '../../../features/chapters';
import type { SearchService } from '../../../features/search/search.service';
import type { Logger } from '../../../server/telemetry/logger';

/** Everything an `/api/v1` route handler is allowed to reach for. */
export interface ApiV1Deps {
  /** The catalog service (features/catalog's public surface). */
  readonly catalog: CatalogService;
  /**
   * The chapter read port. On this seam because the chapter-pages route used to
   * build its own `Db` and read `queries/reader-state.ts` directly — a
   * direct-database path that also carried the P0 in its sibling. → F-006-S2
   */
  readonly chapters: ChapterRepository;
  /**
   * The search service (T-SEARCH-001, F-011-S1).
   *
   * It is read by `/api/search`, which is NOT a `/api/v1` path — but it takes its
   * deps from this seam anyway, because the alternative is a third registry and a
   * second catalog composition for the same public rows. The seam is already the
   * "public data, one composition, lazy once per process" joint; search is public
   * data. The `/api` members' seam would be the wrong home: its bundle is built
   * for session-scoped reads, and search must work with no session at all.
   */
  readonly search: SearchService;
  /**
   * Resolves the CALLER from the verified session, or null for anonymous.
   * T-AUTH-007 owns the real implementation; until then the registry carries
   * this as an explicit null-returning default rather than a guess.
   */
  readonly resolveCaller: (request: Request) => Promise<CallerContext>;
  /** The logging facade (OBSERVABILITY.md §3). Never `console` (AGENTS §4). */
  readonly logger: Logger;
}

let registered: ApiV1Deps | null = null;

/** The lazy composition's in-flight or settled result; `null` until first use. */
let bootstrapped: Promise<ApiV1Deps> | null = null;

/**
 * Registers the wired dependencies.
 *
 * A test seam AND the fast path: when something has registered deps, no
 * composition is built. `apiV1DepsWith` checks this first, so a registered
 * bundle always wins over building one.
 *
 * @param deps the services, the caller resolver and the logger
 */
export function registerApiV1Deps(deps: ApiV1Deps): void {
  registered = deps;
}

/**
 * The registered dependencies, or `null` when nothing has been registered yet.
 *
 * Synchronous on purpose: a caller that only inspects state (a test asserting
 * "not wired") must not have to await anything. A ROUTE wants
 * {@link apiV1DepsWith}, not this.
 */
export function apiV1Deps(): ApiV1Deps | null {
  return registered;
}

/**
 * The dependencies for a request, building the composition on first use.
 *
 * ── Why lazy, and not a boot hook ──────────────────────────────────────────
 * `buildApiV1Deps()` opens a database connection, so it is async; a Next.js
 * `instrumentation.ts` boot hook is a SEPARATE module graph from the route
 * handler's, so a value registered there is not the value this module reads
 * (verified by running the app, not assumed: the registry stayed empty and every
 * route answered 500). Building here — inside the module the route actually
 * reads — is what makes the wiring real. The cost is that the first request pays
 * for the connection, which is why the promise is shared process-wide.
 *
 * A FAILED build is deliberately not cached: `createDb` is fail-fast by design
 * (DEPLOYMENT.md §4), so the failure is usually a database that was not up yet,
 * and caching it would turn one boot race into a permanent 500 for the life of
 * the process. The next request tries again and the error reaches the route,
 * which logs it with its real cause.
 *
 * @param build the composition builder, called at most once per process
 * @returns the dependencies, or the builder's rejection
 * @throws whatever `build` throws, after `build` has been attempted
 */
export async function apiV1DepsWith(build: () => Promise<ApiV1Deps>): Promise<ApiV1Deps | null> {
  if (registered !== null) return registered;
  bootstrapped ??= build().then(
    (deps) => {
      registered = deps;
      return deps;
    },
    (cause: unknown) => {
      // Not memoised: see above. A dropped handle is what lets the retry run.
      bootstrapped = null;
      throw cause;
    },
  );
  return bootstrapped;
}
