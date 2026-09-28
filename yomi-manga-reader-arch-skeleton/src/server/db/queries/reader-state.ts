/**
 * Reader-owned state and session queries.
 *
 * These used to live inline in the route handlers under `app/api/**`, which broke two rules
 * at once: `dependency-rules.md` §1 forbids `app/**` from importing `drizzle-orm` or touching
 * the driver, and the relational query builder (`db.query.<table>`) is untyped here because
 * the schema declares no `relations()`. Both errors looked like lint noise; neither was.
 *
 * So the queries live here, in the one layer allowed to talk to Drizzle, and they use the core
 * query builder, which is fully typed without needing relations. Routes receive rows and
 * decide the HTTP response; they do not know a table exists.
 *
 * Requirement/task references: FR-READER-*, FR-AUTH-* (session lifecycle), T-READER-0xx,
 * T-CATALOG-010. Column selections are stated explicitly so a schema change shows up here as
 * a type error rather than as a silently missing field in a response body.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import * as schema from '../schema';

type Executor = Db;

/* ── sessions and users (auth) ────────────────────────────────────────────── */

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: string;
  status: string;
}

/** Look a user up by email. `email` is `citext`, so the comparison is case-insensitive (DATA_MODEL §1). */
export async function findUserByEmail(db: Executor, email: string): Promise<SessionUser | undefined> {
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      displayName: schema.users.displayName,
      passwordHash: schema.users.passwordHash,
      role: schema.users.role,
      status: schema.users.status,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return rows[0];
}

export interface NewSession {
  id: string;
  userId: string;
  sessionToken: string;
  createdAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  lastSeenAt: Date;
}

export async function insertSession(db: Executor, session: NewSession): Promise<void> {
  await db.insert(schema.sessions).values(session);
}

export async function touchLastLogin(db: Executor, userId: string, at: Date): Promise<void> {
  await db.update(schema.users).set({ lastLoginAt: at }).where(eq(schema.users.id, userId));
}

export async function deleteSessionByToken(db: Executor, token: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.sessionToken, token));
}

/* ── chapters and manga (read paths) ──────────────────────────────────────── */

export interface ChapterSummary {
  id: string;
  mangaId: string;
  number: string;
  title: string | null;
  status: string;
  pageCount: number;
  readingOrder: number;
}

export async function findChapterById(db: Executor, id: string): Promise<ChapterSummary | undefined> {
  const rows = await db
    .select({
      id: schema.chapter.id,
      mangaId: schema.chapter.mangaId,
      number: schema.chapter.number,
      title: schema.chapter.title,
      status: schema.chapter.status,
      pageCount: schema.chapter.pageCount,
      readingOrder: schema.chapter.readingOrder,
    })
    .from(schema.chapter)
    .where(eq(schema.chapter.id, id))
    .limit(1);
  return rows[0];
}

export interface MangaSummary {
  id: string;
  slug: string;
  title: string;
  readingDirection: string;
  published: boolean;
  deletedAt: Date | null;
}

export async function findMangaById(db: Executor, id: string): Promise<MangaSummary | undefined> {
  const rows = await db.select({
      id: schema.manga.id,
      slug: schema.manga.slug,
      title: schema.manga.title,
      readingDirection: schema.manga.readingDirection,
      published: schema.manga.published,
      deletedAt: schema.manga.deletedAt,
    }).from(schema.manga).where(eq(schema.manga.id, id)).limit(1);
  return rows[0];
}

export async function findMangaBySlug(db: Executor, slug: string): Promise<MangaSummary | undefined> {
  const rows = await db
    .select({
      id: schema.manga.id,
      slug: schema.manga.slug,
      title: schema.manga.title,
      readingDirection: schema.manga.readingDirection,
      published: schema.manga.published,
      deletedAt: schema.manga.deletedAt,
    })
    .from(schema.manga)
    .where(eq(schema.manga.slug, slug))
    .limit(1);
  return rows[0];
}

export interface PageAssetRow {
  pageNumber: number;
  assetKey: string;
  width: number;
  height: number;
}

/** Pages in reading order; the reader addresses them by page number, so the sort is not optional. */
export async function listChapterPages(db: Executor, chapterId: string): Promise<PageAssetRow[]> {
  return db
    .select({
      pageNumber: schema.chapterPage.pageNumber,
      assetKey: schema.chapterPage.assetKey,
      width: schema.chapterPage.width,
      height: schema.chapterPage.height,
    })
    .from(schema.chapterPage)
    .where(eq(schema.chapterPage.chapterId, chapterId))
    .orderBy(asc(schema.chapterPage.pageNumber));
}

/* ── reader-owned state: library, bookmarks, progress ─────────────────────── */

export async function listLibraryEntries(db: Executor, userId: string) {
  return db.select().from(schema.libraryEntry).where(eq(schema.libraryEntry.userId, userId));
}

export interface NewLibraryEntry {
  id: string;
  userId: string;
  mangaId: string;
  status: string;
  addedAt: Date;
}

export async function insertLibraryEntry(db: Executor, entry: NewLibraryEntry): Promise<void> {
  await db.insert(schema.libraryEntry).values(entry);
}

export async function deleteLibraryEntry(db: Executor, userId: string, mangaId: string): Promise<void> {
  await db
    .delete(schema.libraryEntry)
    .where(and(eq(schema.libraryEntry.userId, userId), eq(schema.libraryEntry.mangaId, mangaId)));
}

export async function listBookmarks(db: Executor, userId: string) {
  return db.select().from(schema.bookmark).where(eq(schema.bookmark.userId, userId));
}

export interface NewBookmark {
  id: string;
  userId: string;
  chapterId: string;
  pageNumber: number | null;
  note: string;
}

export async function insertBookmark(db: Executor, bookmark: NewBookmark) {
  const rows = await db.insert(schema.bookmark).values(bookmark).returning();
  return rows[0];
}

export interface ProgressRow {
  pageNumber: number;
  scrollPosition: number;
  completed: boolean;
  updatedAt: Date;
}

export async function findProgress(
  db: Executor,
  userId: string,
  chapterId: string,
): Promise<ProgressRow | undefined> {
  const rows = await db
    .select({
      pageNumber: schema.readingProgress.pageNumber,
      scrollPosition: schema.readingProgress.scrollPosition,
      completed: schema.readingProgress.completed,
      updatedAt: schema.readingProgress.updatedAt,
    })
    .from(schema.readingProgress)
    .where(and(eq(schema.readingProgress.userId, userId), eq(schema.readingProgress.chapterId, chapterId)))
    .limit(1);
  return rows[0];
}

export interface ProgressUpdate {
  userId: string;
  chapterId: string;
  pageNumber: number;
  scrollPosition: number;
  completed: boolean;
  updatedAt: Date;
}

/**
 * Progress is one row per (user, chapter) — SQ-READER-1 — so the write is an upsert rather
 * than an insert that would collide on the second page view.
 */
export async function upsertProgress(db: Executor, progress: ProgressUpdate): Promise<void> {
  await db
    .insert(schema.readingProgress)
    .values(progress)
    .onConflictDoUpdate({
      target: [schema.readingProgress.userId, schema.readingProgress.chapterId],
      set: {
        pageNumber: progress.pageNumber,
        scrollPosition: progress.scrollPosition,
        completed: progress.completed,
        updatedAt: progress.updatedAt,
      },
    });
}
