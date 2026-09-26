/**
 * server/db/repositories — port implementations (the ONLY SQL in the app).
 *
 * Planned files (one per port, named to match the feature port):
 *   user.repository.ts        — UserRepository        (T-AUTH-001)
 *   session.repository.ts     — SessionRepository     (T-AUTH-006)
 *   manga.repository.ts       — MangaRepository       (T-CATALOG-001)
 *   chapter.repository.ts     — ChapterRepository     (T-CATALOG-001)
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
 * No implementations in the architecture phase.
 */
export const PLANNED_REPOSITORIES = [
  'user', 'session', 'manga', 'chapter', 'progress', 'history',
  'library', 'bookmark', 'search', 'upload-job',
] as const;
