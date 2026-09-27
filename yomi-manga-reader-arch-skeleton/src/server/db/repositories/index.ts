/**
 * server/db/repositories — port implementations (the ONLY SQL in the app).
 *
 * Planned files (one per port, named to match the feature port):
 *   user.repository.ts        — UserRepository        (T-AUTH-001)
 *   session.repository.ts     — SessionRepository     (T-AUTH-006)
 *   manga.repository.ts       — MangaRepository       (T-CATALOG-001)  ✅ landed
 *   chapter.repository.ts     — ChapterRepository     (T-CATALOG-001)  ✅ landed
 *   progress.repository.ts    — ReaderProgressRepository (T-READER-021/022)
 *   history.repository.ts     — HistoryRepository / ProgressReader (T-READER-025)
 *   library.repository.ts     — LibraryRepository     (T-LIB-001/002)
 *   bookmark.repository.ts    — BookmarkRepository    (T-LIB-007)
 *   search.repository.ts      — SearchRepository      (T-SEARCH-001/002)
 *   upload-job.repository.ts  — UploadJobRepository   (T-UPLOAD-007)
 *
 * Rules:
 * - Each file implements EXACTLY one feature port (import the interface
 *   from the feature's public surface; D1 is inverted here: server MAY
 *   import feature port definitions, never feature logic).
 * - Parameterized queries only (Drizzle; NFR-SEC-015). No `.sql`
 *   string-building with runtime values (the escape hatch is for fixed
 *   templates, reviewed).
 * - Hot queries carry an index comment (T-PERF-004).
 * - Row → DTO mapping at the boundary (data-flow.md §7).
 *
 * Registered so far: the two catalog repositories of T-CATALOG-001. Every other
 * port is still a skeleton and stays in {@link PLANNED_REPOSITORIES} until its
 * own task lands — an entry is removed only when the file exists.
 *
 * Tasks: T-CATALOG-001 (this file's `manga`/`chapter` entries).
 * Requirements: NFR-SEC-015, NFR-PERF-014.
 */
import type { ChapterRepository } from '../../../features/chapters';
import type { MangaRepository } from '../../../features/manga';
import type { Db } from '../client';
import { createChapterRepository } from './chapter.repository';
import { createMangaRepository } from './manga.repository';

/** The repository bundle the composition root injects into features (D1). */
export interface Repositories {
  /** `MangaRepository` — T-CATALOG-001. */
  readonly manga: MangaRepository;
  /** `ChapterRepository` — T-CATALOG-001. */
  readonly chapters: ChapterRepository;
}

/**
 * Wires the landed repositories over one Drizzle handle.
 *
 * `createDb(env)` is the only thing that opens a connection, so the composition
 * root builds the handle once and hands it here (DEPLOYMENT.md §4 step 2).
 * Nothing in this file queries the database by itself.
 *
 * @param db the application's database handle (`createDb`)
 */
export function createRepositories(db: Db): Repositories {
  return {
    manga: createMangaRepository(db),
    chapters: createChapterRepository(db),
  };
}

export { createMangaRepository, buildCatalogListQuery, mangaVisibleWhere } from './manga.repository';
export {
  createChapterRepository,
  buildChapterListQuery,
  buildChapterPagesQuery,
} from './chapter.repository';

/** The ports still to be implemented, by their TASK id. */
export const PLANNED_REPOSITORIES = [
  'user', 'session', 'progress', 'history',
  'library', 'bookmark', 'search', 'upload-job',
] as const;
