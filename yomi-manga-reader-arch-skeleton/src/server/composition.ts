/**
 * The composition root — the ONLY place all layers meet.
 *
 * Responsibility: env → infrastructure (db, storage, media, telemetry,
 * session store) → port implementations (repositories, ports) → service
 * instances (catalog, chapters, reader-progress, library, search, admin,
 * uploads, auth). Route handlers and RSC pages consume these service
 * instances; they NEVER construct infrastructure (rules D1/D6).
 *
 * Requirements: module-boundaries.md §2 (composition charter),
 * data-flow.md §7 (typed crossings), NFR-OPS-002 (typed env at boot).
 * Task: wired incrementally as each service lands (env at T-FOUND-002; the
 * catalog service at T-CATALOG-002/006/007; the rest at T-READER-*, T-LIB-*,
 * T-SEARCH-*, T-UPLOAD-*, T-AUTH-*; complete at VS-11).
 *
 * Rules:
 * - Adding a port without registering it here is a broken skeleton
 *   (typecheck enforces via the service constructors).
 * - Environment-dependent choices (e.g., telemetry on/off, storage
 *   endpoint) are decided HERE from the validated Env — nowhere else.
 * - Singletons per process; no request-scoped state lives here.
 * - `loadEnv()` is called EXACTLY ONCE per process, here, and nowhere else;
 *   it is fail-fast and redacted (DEPLOYMENT.md §4 step 1, T-FOUND-002).
 * - This module does NOT know the `/api/v1` registry. It hands back services;
 *   `src/app/api/v1/_runtime.ts` is what adapts them to that seam, so the
 *   dependency runs server ← app and never the other way round.
 *
 * TODO(T-PROD-*): the remaining services —
 *   chapters, progress, library, search, admin, uploads, auth, media,
 *   storage, telemetry, guards.
 */
import { createCatalogService, type CatalogService } from '../features/catalog';
import { createResumeService } from '../features/progress';
import { loadEnv } from '../shared/validation';
import type { Env, EnvSource } from '../shared/validation';
import { createDb, closeDb, type Db } from './db/client';
import { createProgressPositionReader } from './db/repositories/progress.repository';
import { createRepositories } from './db/repositories';
import { createLogger, type Logger } from './telemetry/logger';

/** What the boot plan holds before any connection is opened. */
export interface Composition {
  /** The validated, redacted environment (NFR-OPS-002). */
  readonly env: Env;
  /** The process logger (OBSERVABILITY.md §3). */
  readonly logger: Logger;
}

/**
 * The catalog half of the composition: the one service that has landed, plus
 * the handle needed to drain its pool on shutdown.
 */
export interface CatalogComposition {
  /** The catalog service (T-CATALOG-002/006/007/009). */
  readonly catalog: CatalogService;
  /** The process logger, so a route reports through the real one. */
  readonly logger: Logger;
  /** Drains the database pool (DEPLOYMENT.md §5). */
  close(): Promise<void>;
}

/**
 * Boot step 1: validate the environment and hand back the plan.
 *
 * Synchronous and side-effect-free apart from the log level, because the point
 * of the split is that a bad deploy fails HERE — before a connection is opened
 * and before a request exists — with a redacted message (NFR-SEC-009,
 * DEPLOYMENT.md §4 step 1). `createDb` then fails fast on an unreachable
 * database (step 2), so neither failure can present itself as a reader's 500.
 *
 * @param source the environment source; the real process env when omitted
 * @returns the validated boot plan
 * @throws {ConfigurationError} when the environment is incomplete or malformed
 *
 * Requirements: NFR-OPS-002, NFR-SEC-009. Task: T-FOUND-002.
 */
export function buildComposition(source?: EnvSource): Composition {
  const env: Env = loadEnv(source);
  return { env, logger: createLogger(env) };
}

/**
 * Boot step 2 for the catalog: open the database and wire the landed ports.
 *
 * Memoised per process by the caller (`apiV1DepsWith`), not here, so this stays
 * a plain async factory that a test can call directly.
 *
 * One port is deliberately absent, and it is not faked (AGENTS.md §4.3):
 * `vocabulary` (`CatalogVocabularyPort`, FR-CATALOG-002) has no
 * implementation, so `facets()` reports the gap. Until it lands,
 * `GET /api/v1/catalog/facets` is a 500 and the discover page's genre filter
 * shows its unavailable state — the honest outcome, and NOT a licence to pass a
 * fake vocabulary.
 *
 * @param source the environment source; the real process env when omitted
 * @returns the wired catalog service and the pool handle
 * @throws {DatabaseConfigurationError} when the DSN is unusable or unreachable
 *
 * Requirements: NFR-OPS-002, NFR-PERF-014, FR-CATALOG-001…009.
 * Tasks: T-CATALOG-002, T-CATALOG-006, T-CATALOG-007, T-CATALOG-009.
 */
export async function createCatalogComposition(source?: EnvSource): Promise<CatalogComposition> {
  const { env, logger } = buildComposition(source);
  const db: Db = await createDb(env);
  const { manga, chapters } = createRepositories(db);
  return {
    catalog: createCatalogService({
      manga,
      chapters,
      // T-CATALOG-009's landed half: the resume RULES live in the feature and
      // the Drizzle READ here, and `ResumeService` extends `ProgressReader`, so
      // this is the injection its own header asked the composition root for.
      progress: createResumeService({ reads: createProgressPositionReader(db) }),
    }),
    logger,
    close: () => closeDb(db),
  };
}
