/**
 * The reader-owned state queries the /api/library, /api/bookmarks and
 * /api/chapters/[chapterId]/progress routes actually call, over a REAL database.
 *
 * These seven functions in `server/db/queries/reader-state.ts` are the whole of
 * INT-LIB-001's subject, and until now no test touched them: every suite for
 * this surface was `describe.todo`, so the numbers reported for the library were
 * counting files, not behaviour. This file is the safety net the T-LIB-001 port
 * refactor needs — the queries are about to MOVE from a shared module into
 * `server/db/repositories/*`, and a move that changes what a row contains is
 * invisible to a type checker.
 *
 * It calls the shipping functions directly rather than re-deriving their SQL, so
 * a change to the query is a change to this test's subject (HARNESS.md §5).
 *
 * What is asserted here, and what is deliberately not:
 * - The observable contract of each function against the real schema: the row
 *   it returns, the primary-key conflicts it survives, the scope of its WHERE.
 * - NOT the HTTP status codes. Those belong to a route test, and asserting them
 *   here would be asserting against a stub of the route.
 *
 * A finding this file already carries, recorded rather than worked around:
 * `NewLibraryEntry` declares `id` and `status`, and `POST /api/library` sends
 * `status: 'reading'`, but `library_entry` has NEITHER column (DATA_MODEL §11 is
 * `user_id, manga_id, added_at, last_read_at`). Drizzle drops keys the table does
 * not declare, so the insert succeeds and `status` is silently discarded. The
 * test below pins the ACTUAL persisted shape, and the discarded field is named
 * in the assertion message rather than hidden.
 *
 * Requirements: FR-LIBRARY-001…009, FR-READER-012/014, NFR-DATA-003, NFR-SEC-015.
 * Tasks: T-LIB-001 (this is the behaviour the port refactor must preserve),
 *        T-LIB-007 (bookmarks), T-READER-021/022 (progress).
 *
 * DSN: `DATABASE_URL`; SKIPS without it. Throwaway database, own port.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteLibraryEntry,
  findProgress,
  insertBookmark,
  insertLibraryEntry,
  listBookmarks,
  listLibraryEntries,
  upsertProgress,
} from '../../src/server/db/queries/reader-state';
import * as schema from '../../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { openCatalogDatabase } from './support/pg-catalog-ports';
import type { OpenDatabase } from './support/pg-catalog-ports';
import { deterministicUuid } from '../../scripts/seed.mjs';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

const ALPHA_SLUG = 'lib-alpha';
const BETA_SLUG = 'lib-beta';

const ALPHA_ID = deterministicUuid('manga', ALPHA_SLUG);
const BETA_ID = deterministicUuid('manga', BETA_SLUG);
const ALPHA_CHAPTER = deterministicUuid('chapter', ALPHA_SLUG);
const BETA_CHAPTER = deterministicUuid('chapter', BETA_SLUG);
const USER_A = deterministicUuid('user', 'lib-a');
const USER_B = deterministicUuid('user', 'lib-b');

const addedAt = new Date('2026-02-01T10:00:00.000Z');

describeDb('reader-state queries against the real schema (INT-LIB-001)', () => {
  let open: OpenDatabase;

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'library_int');

    await open.db.insert(schema.users).values([
      {
        id: USER_A,
        email: 'lib-a@lib.invalid',
        displayName: 'Lib A',
        passwordHash: 'not-a-real-hash',
      },
      {
        id: USER_B,
        email: 'lib-b@lib.invalid',
        displayName: 'Lib B',
        passwordHash: 'not-a-real-hash',
      },
    ]);

    await open.db.insert(schema.manga).values([
      { id: ALPHA_ID, slug: ALPHA_SLUG, title: 'Lib Alpha', published: true },
      { id: BETA_ID, slug: BETA_SLUG, title: 'Lib Beta', published: true },
    ]);

    await open.db.insert(schema.chapter).values([
      { id: ALPHA_CHAPTER, mangaId: ALPHA_ID, number: '1', readingOrder: 1, status: 'published' },
      { id: BETA_CHAPTER, mangaId: BETA_ID, number: '1', readingOrder: 1, status: 'published' },
    ]);
  });

  afterAll(async () => {
    await open?.close();
  });

  describe('insertLibraryEntry / listLibraryEntries / deleteLibraryEntry', () => {
    it('persists only the columns library_entry actually declares', async () => {
      await insertLibraryEntry(open.db, {
        id: deterministicUuid('ignored-id', ALPHA_SLUG),
        userId: USER_A,
        mangaId: ALPHA_ID,
        // Not a column. Sent by POST /api/library and dropped by Drizzle; see
        // this file's header. The assertion states the real shape instead of
        // pretending `status` round-trips.
        status: 'reading',
        addedAt,
      });

      const rows = await listLibraryEntries(open.db, USER_A);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: USER_A, mangaId: ALPHA_ID, addedAt });
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(['addedAt', 'lastReadAt', 'mangaId', 'userId']);
    });

    it('scopes the shelf to one user (FR-LIBRARY-002)', async () => {
      await insertLibraryEntry(open.db, {
        id: deterministicUuid('ignored-id', BETA_SLUG),
        userId: USER_B,
        mangaId: BETA_ID,
        status: 'reading',
        addedAt,
      });

      expect((await listLibraryEntries(open.db, USER_A)).map((r) => r.mangaId)).toEqual([ALPHA_ID]);
      expect((await listLibraryEntries(open.db, USER_B)).map((r) => r.mangaId)).toEqual([BETA_ID]);
    });

    it('rejects a second add for the same (user, manga) — the PK decides, not the code', async () => {
      // POST /api/library is documented as idempotent (double-add is a no-op,
      // not a 409), and the route relies on the primary key to make that true.
      // Asserted here so the port refactor cannot quietly change it to a
      // caller-side pre-check that TOCTOU-races under concurrency.
      await expect(
        insertLibraryEntry(open.db, {
          id: deterministicUuid('ignored-id', 'dupe'),
          userId: USER_A,
          mangaId: ALPHA_ID,
          status: 'reading',
          addedAt,
        }),
      ).rejects.toThrow();

      expect(await listLibraryEntries(open.db, USER_A)).toHaveLength(1);
    });

    it('removes only the addressed (user, manga) pair', async () => {
      await deleteLibraryEntry(open.db, USER_A, ALPHA_ID);

      expect(await listLibraryEntries(open.db, USER_A)).toHaveLength(0);
      // The other user's row is untouched: a delete scoped by one user must not
      // reach across to a second user's identical membership.
      expect(await listLibraryEntries(open.db, USER_B)).toHaveLength(1);
    });
  });

  describe('insertBookmark / listBookmarks', () => {
    it('returns the inserted row', async () => {
      const id = deterministicUuid('bookmark', ALPHA_SLUG);
      const row = await insertBookmark(open.db, {
        id,
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: 4,
        note: 'panel worth keeping',
      });

      expect(row).toMatchObject({
        id,
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: 4,
        note: 'panel worth keeping',
      });
    });

    it('scopes bookmarks to one user', async () => {
      const rows = await listBookmarks(open.db, USER_A);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.chapterId).toBe(ALPHA_CHAPTER);
      expect(await listBookmarks(open.db, USER_B)).toHaveLength(0);
    });

    it('refuses a duplicate bookmark on the same (user, chapter, page)', async () => {
      // ix_bookmarks_user_chapter_page. NULL page_number stays distinct in
      // Postgres, so a chapter-start mark is repeatable — the unique index does
      // NOT prevent that, and this pins that so a refactor adding a blanket
      // dedupe would be caught.
      await insertBookmark(open.db, {
        id: deterministicUuid('bookmark', 'start-1'),
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: null,
        note: '',
      });
      const second = await insertBookmark(open.db, {
        id: deterministicUuid('bookmark', 'start-2'),
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: null,
        note: '',
      });

      expect(second?.id).toBe(deterministicUuid('bookmark', 'start-2'));
    });
  });

  describe('upsertProgress / findProgress', () => {
    it('is undefined before the first write (resume shows a start, not a phantom position)', async () => {
      expect(await findProgress(open.db, USER_A, ALPHA_CHAPTER)).toBeUndefined();
    });

    it('round-trips position, scroll and the completion flag', async () => {
      await upsertProgress(open.db, {
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: 7,
        scrollPosition: 0.25,
        completed: false,
        updatedAt: new Date('2026-02-02T09:00:00.000Z'),
      });

      expect(await findProgress(open.db, USER_A, ALPHA_CHAPTER)).toMatchObject({
        pageNumber: 7,
        scrollPosition: 0.25,
        completed: false,
      });
    });

    it('keeps ONE row per (user, chapter) on re-read instead of colliding', async () => {
      await upsertProgress(open.db, {
        userId: USER_A,
        chapterId: ALPHA_CHAPTER,
        pageNumber: 12,
        scrollPosition: 0.5,
        completed: true,
        updatedAt: new Date('2026-02-03T09:00:00.000Z'),
      });

      const row = await findProgress(open.db, USER_A, ALPHA_CHAPTER);
      expect(row).toMatchObject({ pageNumber: 12, completed: true });

      const all = await open.db
        .select()
        .from(schema.readingProgress)
        .where(eq(schema.readingProgress.userId, USER_A));
      expect(all).toHaveLength(1);
    });

    it('does not read another user progress for the same chapter', async () => {
      await upsertProgress(open.db, {
        userId: USER_B,
        chapterId: ALPHA_CHAPTER,
        pageNumber: 2,
        scrollPosition: 0,
        completed: false,
        updatedAt: new Date('2026-02-04T09:00:00.000Z'),
      });

      expect(await findProgress(open.db, USER_A, ALPHA_CHAPTER)).toMatchObject({ pageNumber: 12 });
      expect(await findProgress(open.db, USER_B, ALPHA_CHAPTER)).toMatchObject({ pageNumber: 2 });
    });
  });
});
