/**
 * Progress API — Wave3: authenticated per-user reading_progress.
 * GET returns { pageNumber } or null for authenticated user.
 * POST upserts for authenticated user only.
 * Negative: unauthenticated → 401, malformed page → 422.
 */
import { loadEnv } from '../../../../../shared/validation/env';
import { createDb, closeDb } from '../../../../../server/db/client';
import * as schema from '../../../../../server/db/schema';
import { getSessionUser } from '../../../../../server/auth/guard';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ chapterId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } }, { status: 401 });
  }
  const { chapterId } = await context.params;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const row = await db.query.readingProgress.findFirst({
      where: (f, { eq, and }) => and(eq(f.userId, user.id), eq(f.chapterId, chapterId)),
    });
    if (!row) return Response.json({ progress: null }, { status: 200 });
    return Response.json({ progress: { pageNumber: row.pageNumber, scrollPosition: row.scrollPosition, completed: row.completed, updatedAt: row.updatedAt } }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } }, { status: 401 });
  }
  const { chapterId } = await context.params;
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'Invalid JSON' } }, { status: 422 }); }
  const pageNumber = Number(body?.pageNumber);
  const scrollPosition = Number(body?.scrollPosition ?? 0);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return Response.json({ error: { code: 'READER_INVALID_PAGE', message: 'Invalid page' } }, { status: 422 });
  }
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const chapter = await db.query.chapter.findFirst({ where: (f, { eq }) => eq(f.id, chapterId) });
    if (!chapter) return Response.json({ error: { code: 'CHAPTER_NOT_FOUND' } }, { status: 404 });
    const maxPage = chapter.pageCount ?? 1000;
    if (pageNumber > maxPage) {
      // malformed beyond pageCount → 422 per failure path
      return Response.json({ error: { code: 'READER_INVALID_PAGE', message: `Page out of range 1..${maxPage}` } }, { status: 422 });
    }
    const clampedPage = Math.min(Math.max(1, pageNumber), maxPage);
    await db.insert(schema.readingProgress).values({
      userId: user.id,
      chapterId,
      pageNumber: clampedPage,
      scrollPosition: Number.isFinite(scrollPosition) ? scrollPosition : 0,
      completed: Boolean(body?.completed),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [schema.readingProgress.userId, schema.readingProgress.chapterId],
      set: {
        pageNumber: clampedPage,
        scrollPosition: Number.isFinite(scrollPosition) ? scrollPosition : 0,
        completed: Boolean(body?.completed),
        updatedAt: new Date(),
      },
    });
    return Response.json({ ok: true, pageNumber: clampedPage }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}
