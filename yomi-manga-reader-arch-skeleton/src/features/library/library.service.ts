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
import { AppError } from '../../shared/contracts/errors';
import type { Bookmark, Caller, LibraryEntry, LibrarySort } from '../../shared/contracts';
import type { BookmarkId, ChapterId, MangaId, UserId } from '../../shared/types';

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

/** The note limit is a contract, not a preference: NFR-SEC-016 / DATA_MODEL §14 CHECK. */
const NOTE_MAX = 280;

/**
 * The caller's id, or `AUTH_REQUIRED` (401).
 *
 * Every method below funnels through this rather than reading `caller.userId`
 * directly, so the rule "these are the members-only surface, THREAT T-04" is
 * stated once instead of being re-derived in seven places. A null caller is the
 * anonymous case, and the anonymous case has no shelf.
 */
function requireUser(caller: Caller): UserId {
  if (caller === null) throw new AppError('AUTH_REQUIRED');
  return caller.userId;
}

/**
 * The service over its four ports (T-LIB-001 wiring).
 *
 * The heavy lifting — the `unreadChapterCount` subquery, the `lastRead` join,
 * cursor pagination — lives in the repositories, because those are the statements
 * that have to stay one-per-page. What lives here is the part that is about the
 * CALLER: authentication, the note bound, and the read-status rule that spans two
 * ports.
 *
 * @param deps.library  the `LibraryRepository` (server/db, T-LIB-001/002)
 * @param deps.bookmarks the `BookmarkRepository` (server/db, T-LIB-007)
 * @param deps.progress the `ProgressReader` for resume data (T-CATALOG-009)
 * @param deps.chapters the `ChapterRepository` for visibility (T-CATALOG-001)
 */
export function createLibraryService(deps: {
  library: import('./library.repository').LibraryRepository;
  bookmarks: import('./library.repository').BookmarkRepository;
  progress: import('../progress').ProgressReader;
  chapters: import('../chapters').ChapterRepository;
  /** Needed only by {@link LibraryService.setReadStatus}, the one write that spans two ports. */
  readerProgress?: import('../progress').ReaderProgressRepository;
}): LibraryService {
  // `deps.progress` (the `ProgressReader`) is part of this factory's declared shape and
  // the composition supplies it, but no method here calls it: the shelf's `lastRead`
  // and its unread badge are computed in ONE statement inside the library repository
  // (T-LIB-002's no-N+1 rule), and a second read through this port would be exactly
  // the per-entry query that rule forbids. It stays declared so the composition has one
  // place to wire the reader, and out of the destructure because reading it would be
  // dead weight rather than a dependency.
  const { library, bookmarks, chapters, readerProgress } = deps;

  return {
    async add(caller, mangaId) {
      // FR-LIBRARY-001: a double-add is a no-op, not a 409, and the PK makes that
      // true atomically. The route still confirms the manga exists first, so a typo
      // is a 404 rather than an FK error.
      await library.add(requireUser(caller), mangaId as MangaId);
    },

    async remove(caller, mangaId) {
      // FR-LIBRARY-002: 204 whether or not the row was there (API_CONTRACT §2.4).
      // The owner is in the repository's WHERE, so this cannot reach another shelf.
      await library.remove(requireUser(caller), mangaId as MangaId);
    },

    async list(caller, query) {
      // An absent sort is the contract's default, not a missing argument: a
      // repository that indexed the sort directly would throw a bare TypeError
      // (500) for a caller that skipped this line. The optional fields are spread
      // rather than passed as `undefined` because the project compiles with
      // `exactOptionalPropertyTypes`, where `cursor: undefined` is not the same
      // shape as omitting the key.
      return library.list(requireUser(caller), {
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
        sort: query.sort ?? 'last_read_desc',
      });
    },

    async createBookmark(caller, input) {
      const userId = requireUser(caller);
      const note = input.note ?? '';
      // The bound is enforced HERE, not only by the table's CHECK: a 280-over note
      // should be a 422 with a field name, not an opaque 500 from the database
      // (NFR-SEC-016, API_CONTRACT §6). Length counts code units, which is what
      // Postgres `char_length` counts too, so the two cannot disagree.
      if (note.length > NOTE_MAX) {
        throw new AppError('VALIDATION_FIELD_INVALID', {
          details: [{ path: 'note', message: `Must be at most ${NOTE_MAX} characters.` }],
        });
      }
      return bookmarks.create({
        userId,
        chapterId: input.chapterId as ChapterId,
        // `undefined` and `null` both mean "chapter start"; the column is nullable
        // and the contract's `pageNumber?: number | null` allows either spelling.
        pageNumber: input.pageNumber ?? null,
        note,
      });
    },

    async listBookmarks(caller, query) {
      return bookmarks.list(requireUser(caller), {
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        ...(query.limit === undefined ? {} : { limit: query.limit }),
      });
    },

    async removeBookmark(caller, bookmarkId) {
      // The repository returns false for "not yours" and "not there" alike — the
      // same answer, deliberately (THREAT T-04). One code for both means a probe
      // cannot learn whether another reader's bookmark id exists.
      const removed = await bookmarks.delete(requireUser(caller), bookmarkId as BookmarkId);
      if (!removed) throw new AppError('LIBRARY_BOOKMARK_NOT_FOUND');
    },

    async setReadStatus(caller, chapterId, read) {
      const userId = requireUser(caller);
      // Visibility first: a reader must not be able to mark an unpublished chapter
      // as read and thereby probe for its existence. `byId` already applies the
      // draft/soft-delete rule, so a null here is indistinguishable from "absent".
      const chapterRow = await chapters.byId(chapterId as ChapterId, caller);
      if (chapterRow === null) throw new AppError('CHAPTER_NOT_FOUND');

      if (read) {
        // Sticky completion is the repository's rule (FR-LIBRARY-007): a completed
        // row never returns to false through this path.
        await readerProgress?.saveProgress(userId, {
          chapterId: chapterId as ChapterId,
          pageNumber: chapterRow.pageCount,
          scrollPosition: 0,
          completed: true,
        });
        return;
      }

      // read=false is the ONLY unset path (NFR-DATA-003). The progress save path
      // can never unset — that is why this branch exists as a separate statement
      // rather than a flag on the save.
      const existing = await readerProgress?.getProgress(userId, chapterId as ChapterId);
      if (existing === null || existing === undefined) return;
      await readerProgress?.saveProgress(userId, {
        chapterId: chapterId as ChapterId,
        pageNumber: existing.pageNumber,
        scrollPosition: existing.scrollPosition,
        // The repository ORs the flag, so a false here cannot clear a sticky true.
        // Unsetting therefore needs the dedicated write, which does not exist yet
        // on the port; until it does, `read=false` is a documented no-op rather
        // than a silent lie. Recorded as SQ-LIB-7.
        completed: existing.completed,
      });
    },
  };
}
