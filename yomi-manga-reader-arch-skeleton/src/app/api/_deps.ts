/**
 * The unversioned `/api` dependency seam — the members' surface
 * (T-LIB-001, T-LIB-007, T-READER-025).
 *
 * Why a SECOND seam rather than moving these routes under `/api/v1`
 * ------------------------------------------------------------------
 * `API_CONTRACT.md` §2.3/§2.4 name these endpoints `/api/v1/…`, but the
 * implemented handlers are un-versioned and are already published: the reader
 * client fetches `/api/chapters/{id}/progress` and the seed's own runtime proof
 * curls `/api/library` and `/api/bookmarks`. Moving them would break published
 * URLs and the recorded evidence to tidy a directory, so the seam sits where the
 * routes already are. Both seams now hold the same shape — a registry, a lazy
 * build, a caller resolver — and neither route constructs infrastructure (D6).
 *
 * Why it must not import infrastructure (rule D6)
 * ------------------------------------------------
 * This module holds a `LibraryService`, a `HistoryRepository`, a caller resolver
 * and a `Logger` — nothing else. The composition BUILDER is passed in by the
 * caller of {@link apiDepsWith}, never imported here, because a seam that
 * imports the database it exists to hide is not a seam.
 *
 * The acting user is ALWAYS whatever the resolver returns from the verified
 * session, and NEVER anything from the query string or the body (API_CONTRACT §1
 * input identity rule, THREAT T-04). The routes below take the caller from here
 * and nowhere else.
 *
 * Requirements: API_CONTRACT §2.4, NFR-SEC-002, NFR-OPS-002, THREAT T-04.
 * Tasks: T-LIB-001, T-LIB-007, T-LIB-008, T-READER-025.
 */
import type { CallerContext } from '../../shared/contracts';
import type { LibraryService } from '../../features/library';
import type { HistoryRepository } from '../../features/progress';
import type { Logger } from '../../server/telemetry/logger';
import type { MangaRepository } from '../../features/manga';
import type { ChapterRepository } from '../../features/chapters';

/** Everything an `/api` members' route handler is allowed to reach for. */
export interface ApiDeps {
  /** Library, bookmarks, read status (features/library's public surface). */
  readonly library: LibraryService;
  /** Reading history sessions and the list (features/progress's public surface). */
  readonly history: HistoryRepository;
  /**
   * Catalog READ ports, so a route can answer "does this title/chapter exist?"
   * with the contract's 404 rather than letting a foreign-key violation surface as
   * a bare 500. Read-only on this seam: writes belong to the services above.
   */
  readonly manga: MangaRepository;
  readonly chapters: ChapterRepository;
  /**
   * Resolves the CALLER from the verified session cookie, or null for anonymous.
   *
   * Every service method turns null into `AUTH_REQUIRED` (401) on its own, so a
   * route can pass the context straight through rather than pre-checking.
   */
  readonly resolveCaller: (request: Request) => Promise<CallerContext>;
  /** The logging facade (OBSERVABILITY.md §3). Never `console` (AGENTS §4). */
  readonly logger: Logger;
}

let registered: ApiDeps | null = null;

/** The lazy composition's in-flight or settled result; `null` until first use. */
let bootstrapped: Promise<ApiDeps> | null = null;

/**
 * Registers the wired dependencies.
 *
 * A test seam AND the fast path: when something has registered deps, no
 * composition is built. A registered bundle always wins over building one.
 *
 * @param deps the services, the caller resolver and the logger
 */
export function registerApiDeps(deps: ApiDeps): void {
  registered = deps;
}

/**
 * The registered dependencies, or `null` when nothing has been registered yet.
 *
 * Synchronous on purpose: a caller that only inspects state (a test asserting
 * "not wired") must not have to await anything.
 */
export function apiDeps(): ApiDeps | null {
  return registered;
}

/**
 * The dependencies for a request, building the composition on first use.
 *
 * A FAILED build is deliberately not cached: `createDb` is fail-fast by design, so
 * the failure is usually a database that was not up yet, and caching it would turn
 * one boot race into a permanent 500 for the life of the process.
 *
 * @param build the composition builder, called at most once per process
 * @returns the dependencies, or the builder's rejection
 * @throws whatever `build` throws, after `build` has been attempted
 */
export async function apiDepsWith(build: () => Promise<ApiDeps>): Promise<ApiDeps | null> {
  if (registered !== null) return registered;
  bootstrapped ??= build().then(
    (deps) => {
      registered = deps;
      return deps;
    },
    (cause: unknown) => {
      bootstrapped = null;
      throw cause;
    },
  );
  return bootstrapped;
}
