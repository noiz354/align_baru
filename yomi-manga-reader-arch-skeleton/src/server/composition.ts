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
 *   search, admin, uploads, auth, media, storage, telemetry, guards.
 */
import { createCatalogService, type CatalogService } from '../features/catalog';
import { createLibraryService, type LibraryService } from '../features/library';
import { createSearchService, type SearchService } from '../features/search/search.service';
import {
  createResumeService,
  type HistoryRepository,
  type ReaderProgressRepository,
} from '../features/progress';
import { loadEnv } from '../shared/validation';
import type { Env, EnvSource } from '../shared/validation';
import { acquireDb, releaseDb, type Db } from './db/client';
import {
  createProgressPositionReader,
  createReaderProgressRepository,
} from './db/repositories/progress.repository';
import { createGenreTagVocabularyPort } from './db/repositories/vocabulary.repository';
import { createSearchRepository } from './db/repositories/search.repository';
import { createHistoryRepository } from './db/repositories/history.repository';
import {
  createBookmarkRepository,
  createLibraryRepository,
} from './db/repositories/library.repository';
import { createRepositories } from './db/repositories';
import type { ChapterRepository } from '../features/chapters';
import type { MangaRepository } from '../features/manga';
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
  /**
   * The chapter read port, for the chapter-pages route.
   *
   * It was reading `queries/reader-state.ts` directly — its own connection, no
   * service, no port — and that file is deleted in F-006-S2. `pageList` also
   * carries the prev/next published neighbours (FR-READER-016), so routing through
   * it hands the reader chapter navigation for free. → F-006-S2, F-007-S1
   */
  readonly chapters: ChapterRepository;
  /**
   * The search service (T-SEARCH-001, F-011-S1).
   *
   * It lives in the CATALOG composition because that is the public-data root:
   * search reads published titles, aliases, creators and tags — the same rows the
   * catalog reads, through the same pool, with no session anywhere near it. The
   * `/api/search` route takes it from the `/api/v1` seam for exactly that reason
   * (see that route's header for why it shares the seam rather than growing a
   * third registry).
   */
  readonly search: SearchService;
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
 * Nothing is faked here (AGENTS.md §4.3): every port the catalog service takes
 * is registered from a real implementation. When one is missing, `facets()` and
 * `resolveResume()` report the gap instead of inventing an answer — which is why
 * this list is short only while the landed repositories are short.
 *
 * @param source the environment source; the real process env when omitted
 * @returns the wired catalog service and the pool handle
 * @throws {DatabaseConfigurationError} when the DSN is unusable or unreachable
 *
 * Requirements: NFR-OPS-002, NFR-PERF-014, FR-CATALOG-001…009.
 * Tasks: T-CATALOG-002, T-CATALOG-006, T-CATALOG-007, T-CATALOG-009,
 * T-CATALOG-012.
 */
export async function createCatalogComposition(source?: EnvSource): Promise<CatalogComposition> {
  const { env, logger } = buildComposition(source);
  const db: Db = await acquireDb(env);
  const { manga, chapters } = createRepositories(db);
  return {
    catalog: createCatalogService({
      manga,
      chapters,
      // T-CATALOG-009's landed half: the resume RULES live in the feature and
      // the Drizzle READ here, and `ResumeService` extends `ProgressReader`, so
      // this is the injection its own header asked the composition root for.
      progress: createResumeService({ reads: createProgressPositionReader(db) }),
      // T-CATALOG-012: the facets read. It used to be registered nowhere, so
      // `GET /api/v1/catalog/facets` was a 500 and `/discover`'s genre filter
      // showed its unavailable state on a perfectly healthy deployment.
      vocabulary: createGenreTagVocabularyPort(db),
    }),
    chapters,
    // T-SEARCH-001: the public search service, on the public-data composition.
    search: createSearchService({ search: createSearchRepository(db) }),
    logger,
    close: () => releaseDb(db),
  };
}

/**
 * The members' half of the composition: the library, its bookmarks, and reading
 * history — the personal surface behind `/library`, `/bookmarks` and `/history`.
 *
 * Separate from {@link createCatalogComposition} rather than folded into it because
 * the two answer to different visibility rules: the catalog is public, these three
 * are THREAT T-04 surfaces scoped to the session caller. A single bundle would make
 * "which service can an anonymous request reach?" a question about a shared object
 * rather than about a named one.
 *
 * @param source the raw environment; defaults to `process.env`
 * @returns the library service, the history repository, and the pool drain
 *
 * @throws {DatabaseConfigurationError} when the DSN is unusable or unreachable
 *
 * Requirements: FR-LIBRARY-001…010, FR-READER-015, NFR-DATA-003/005/006.
 * Tasks: T-LIB-001/002/007, T-LIB-008, T-READER-021/022/025.
 */
export async function createLibraryComposition(source?: EnvSource): Promise<LibraryComposition> {
  const { env, logger } = buildComposition(source);
  const db: Db = await acquireDb(env);
  const { manga, chapters } = createRepositories(db);
  // Built once and shared with the returned bundle below, so the library service
  // and the progress route cannot disagree about who owns `reading_progress`.
  // Two instances would still be correct — the invariants live in the SQL, not in
  // the object — but "one writer" ought to be one object as well.
  const readerProgress = createReaderProgressRepository(db);
  return {
    library: createLibraryService({
      library: createLibraryRepository(db),
      bookmarks: createBookmarkRepository(db),
      // The same resume reader the catalog injects: one implementation, two
      // consumers, so "continue reading" cannot disagree with the library badge.
      progress: createResumeService({ reads: createProgressPositionReader(db) }),
      chapters,
      // The only dependency that spans two ports — `setReadStatus` writes through
      // the progress repository, which is also the single writer of
      // `library_entry.last_read_at` (data-flow.md §5). The SAME instance is
      // returned below for the progress route, so the library and the reader can
      // never disagree about who owns `reading_progress` (F-006-S1).
      readerProgress,
    }),
    history: createHistoryRepository(db),
    // Exposed so the progress route can stop writing `reading_progress` itself.
    // It used `queries/reader-state.ts`'s `upsertProgress`, which plain-overwrites
    // `completed`, while the reader client sends only `{ pageNumber }` — so every
    // page change erased a finished chapter, and `last_read_at` was never
    // maintained. This is the one implementation that gets both right (LWW,
    // idempotence, sticky-OR, denormalized touch, one transaction). → F-006-S1
    readerProgress: createReaderProgressRepository(db),
    // Exposed so a route can answer "is this title/chapter there?" with a 404
    // instead of letting the foreign key speak. Without it, `POST /api/library`
    // with an unknown mangaId surfaced the driver's 23503 as a bare 500, and a
    // bookmark past the end of a chapter was accepted outright — both
    // regressions from taking the direct-database path away.
    manga,
    chapters,
    logger,
    close: () => releaseDb(db),
  };
}

/** The members' services plus the shutdown seam. */
export interface LibraryComposition {
  /** Library, bookmarks and read status (T-LIB-001). */
  readonly library: LibraryService;
  /** Reading history sessions and the history list (T-READER-025). */
  readonly history: HistoryRepository;
  /** The single writer of `reading_progress` and `library_entry.last_read_at` (F-006-S1). */
  readonly readerProgress: ReaderProgressRepository;
  /**
   * The catalog read ports, for existence checks a route must answer itself:
   * an unknown manga is 404 `MANGA_NOT_FOUND`, a page past the chapter's end is
   * 422 `READER_INVALID_PAGE`. Read-only here; writes still belong to services.
   */
  readonly manga: MangaRepository;
  readonly chapters: ChapterRepository;
  /** The process logger, so a route reports through the real one. */
  readonly logger: Logger;
  /** Drains the database pool (DEPLOYMENT.md §5). */
  close(): Promise<void>;
}
