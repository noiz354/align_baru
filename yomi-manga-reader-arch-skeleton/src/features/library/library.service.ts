/**
 * features/library — LibraryService: library, bookmarks, read status.
 *
 * Responsibility: the member's personal surface — add/remove, list with
 * derived data (lastRead, unreadChapterCount), bookmarks CRUD, explicit
 * read-status set/unmark (the ONLY unset path for sticky completion).
 *
 * Requirements: FR-LIBRARY-001…010, FR-READER-017 (interplay).
 * Tasks: T-LIB-001…009.
 *
 * Rules:
 * - All operations scoped to the session caller (THREAT T-04); the port
 *   signatures carry `userId` server-side only (the route guard injects
 *   it from the session — never from input).
 * - `unreadChapterCount` = published chapters − completed (one query,
 *   no N+1 — T-LIB-002).
 * - Library entries survive manga unpublish (private; `unavailable: true`
 *   flag, reading 404s — DATA_MODEL/edge case EC-ADM-02).
 */
import type { Bookmark, LibraryEntry, LibrarySort } from '../../shared/contracts';
import type { Caller } from '../../shared/contracts';

export interface LibraryService {
  add(caller: Caller, mangaId: string): Promise<void>; // idempotent (FR-LIBRARY-001)
  remove(caller: Caller, mangaId: string): Promise<void>; // 204 even when absent (documented)

  list(caller: Caller, query: { cursor?: string; limit?: number; sort?: LibrarySort }): Promise<{
    items: LibraryEntry[];
    nextCursor: string | null;
  }>;

  createBookmark(caller: Caller, input: {
    chapterId: string;
    pageNumber?: number | null; // null = chapter start
    note?: string; // ≤ 280, plain text
  }): Promise<Bookmark>; // duplicate page ⇒ LIBRARY_BOOKMARK_EXISTS (409)

  listBookmarks(caller: Caller, query: { cursor?: string; limit?: number }): Promise<{
    items: Bookmark[];
    nextCursor: string | null;
  }>;

  removeBookmark(caller: Caller, bookmarkId: string): Promise<void>; // 404 if not owned

  /**
   * Explicit read/unread (FR-LIBRARY-007, T-LIB-006).
   * read=true sets completed (sticky thereafter); read=false is the ONLY
   * unset path (the progress save path never unsets — NFR-DATA-003).
   */
  setReadStatus(caller: Caller, chapterId: string, read: boolean): Promise<void>;
}

/**
 * TODO(T-LIB-001): factory (wired with LibraryRepository, BookmarkRepository,
 * ProgressReader, ChapterRepository ports).
 */
export function createLibraryService(deps: {
  library: import('./library.repository').LibraryRepository;
  bookmarks: import('./library.repository').BookmarkRepository;
  progress: import('../progress').ProgressReader;
  chapters: import('../chapters').ChapterRepository;
}): LibraryService {
  throw new Error('Not implemented: T-LIB-001 (library service wiring)');
}
