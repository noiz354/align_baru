/**
 * server/db/repositories — port implementations (the ONLY SQL in the app).
 *
 * Landed files (one per port, named to match the feature port). The ✅ marks
 * are machine-checked by the root `scripts/check-claims.mjs`, which fails when
 * this block names a file that is not on disk.
 *   manga.repository.ts       — MangaRepository       (T-CATALOG-001)  ✅ landed
 *   chapter.repository.ts     — ChapterRepository     (T-CATALOG-001)  ✅ landed
 *   progress.repository.ts    — ResumePositionReader  (T-CATALOG-009)  ✅ landed
 *   vocabulary.repository.ts  — CatalogVocabularyPort (T-CATALOG-012)  ✅ landed
 *
 * Ports with no file yet (the authoritative record of what is still missing is
 * {@link PLANNED_REPOSITORIES}, not this comment — a comment cannot be
 * verified, a constant can):
 *   user.repository.ts        — UserRepository        (T-AUTH-001)
 *   session.repository.ts     — SessionRepository     (T-AUTH-006)
 *   library.repository.ts     — LibraryRepository     (T-LIB-001/002)
 *   bookmark.repository.ts    — BookmarkRepository    (T-LIB-007)
 *   search.repository.ts      — SearchRepository      (T-SEARCH-001/002)
 *   upload-job.repository.ts  — UploadJobRepository   (T-UPLOAD-007)
 *
 * Two attribution traps, both wrong in the revision this block replaced:
 * - `progress.repository.ts` implements the narrow `ResumePositionReader`
 *   (T-CATALOG-009, wired at composition.ts:113), NOT `ReaderProgressRepository`
 *   (T-READER-021/022). The wider port's `getProgress`/`saveProgress` have no
 *   implementation anywhere, so `upsertProgress` in `queries/reader-state.ts`
 *   is still not served by a repository.
 * - It is NOT T-READER-025 either. `HistoryRepository` (T-READER-025, reading
 *   history recording) has no file at all.
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
 * Registered so far: the two catalog repositories of T-CATALOG-001 (the
 * `progress`/`vocabulary` factories are imported directly by the composition
 * root and are not part of this bundle). Every other port is still a skeleton
 * and stays in {@link PLANNED_REPOSITORIES} until its own task lands — an
 * entry is removed only when the file exists.
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

export {
  createMangaRepository,
  buildCatalogListQuery,
  mangaVisibleWhere,
  genreSlugSql,
} from './manga.repository';
export {
  createChapterRepository,
  buildChapterListQuery,
  buildChapterPagesQuery,
} from './chapter.repository';

/**
 * The ports still to be implemented, by their TASK id.
 *
 * Excludes the four landed above. `progress` and `history` are absent because
 * neither port has a file: `progress.repository.ts` is T-CATALOG-009's
 * `ResumePositionReader`, and `HistoryRepository` (T-READER-025) is unimplemented.
 * Kept as a literal so `check-claims.mjs` can verify it against the filesystem.
 */
export const PLANNED_REPOSITORIES = [
  'user', 'session', 'history',
  'library', 'bookmark', 'search', 'upload-job',
] as const;
