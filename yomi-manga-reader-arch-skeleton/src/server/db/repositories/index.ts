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
 *   library.repository.ts     — LibraryRepository + BookmarkRepository (T-LIB-001/002/007) ✅ landed
 *   history.repository.ts     — HistoryRepository     (T-READER-025)  ✅ landed
 *
 * Two repositories carry two ports each, which the one-port-per-file rule
 * permits only where the ports are the same table family: a library membership
 * and its bookmark rows are written and read as one reader-facing surface, and a
 * split would have meant a second `openCatalogDatabase` handle for one question.
 *
 * Ports with no file yet (the authoritative record of what is still missing is
 * {@link PLANNED_REPOSITORIES}, not this comment — a comment cannot be
 * verified, a constant can):
 *   user.repository.ts        — UserRepository        (T-AUTH-001)
 *   session.repository.ts     — SessionRepository     (T-AUTH-006)
 *   search.repository.ts      — SearchRepository      (T-SEARCH-001/002)
 *   upload-job.repository.ts  — UploadJobRepository   (T-UPLOAD-007)
 *
 * Two attribution traps, both wrong in the revision this block replaced, and one
 * of them now resolved:
 * - `progress.repository.ts` implements the narrow `ResumePositionReader`
 *   (T-CATALOG-009, wired at composition.ts:113) AND the wider
 *   `ReaderProgressRepository` (T-READER-021/022) as a second factory in the
 *   same file. The wider port's `getProgress`/`saveProgress` have no
 *   implementation anywhere else, so `upsertProgress` in
 *   `queries/reader-state.ts` is now served.
 * - `history.repository.ts` implements `HistoryRepository` (T-READER-025).
 *   It did not exist when this block first named it as missing.
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
 * Registered so far: the two catalog repositories of T-CATALOG-001. The
 * members' repositories are composed by `createLibraryComposition`
 * (T-LIB-001/002/007, T-READER-021/022/025) rather than by this bundle, because
 * the members' surface is an authenticated root with its own connection
 * lifetime. Every other port is still a skeleton and stays in
 * {@link PLANNED_REPOSITORIES} until its own task lands — an entry is removed
 * only when the file exists.
 *
 * Tasks: T-CATALOG-001 (this file's `manga`/`chapter` entries),
 * T-LIB-001, T-LIB-002, T-LIB-007, T-READER-021, T-READER-022, T-READER-025.
 * Requirements: NFR-SEC-015, NFR-PERF-014, NFR-DATA-001/003/005.
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
 * Excludes every file on disk. `library`, `bookmark` and `history` were members
 * of this list until T-LIB-001/002/007 and T-READER-025 landed their files; the
 * root `check-claims.mjs` fails the build if this array names one that exists,
 * which is what caught the list outliving the code it described.
 *
 * Note the naming: `bookmark` is no longer planned but has no file of its own,
 * because `library.repository.ts` implements `BookmarkRepository` beside
 * `LibraryRepository`. The list is "ports without a file", not "ports".
 * Kept as a literal so `check-claims.mjs` can verify it against the filesystem.
 */
export const PLANNED_REPOSITORIES = ['user', 'session', 'search', 'upload-job'] as const;
