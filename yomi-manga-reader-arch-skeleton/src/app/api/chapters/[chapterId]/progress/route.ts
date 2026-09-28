/**
 * Progress API — minimal wave2: stores reading_progress for demo user.
 * GET returns { pageNumber, scrollPosition } or null
 * POST expects { pageNumber, scrollPosition?, completed? } and upserts.
 * Uses fixed demo user reader.demo@example.test so no auth is required for demo.
 */
import { createHash } from 'node:crypto';
import { loadEnv } from '../../../../../shared/validation/env';
import { createDb, closeDb } from '../../../../../server/db/client';
import * as schema from '../../../../../server/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function demoUserId() {
  const email = 'reader.demo@example.test';
  const hash = createHash('sha256').update(`user:${email}`).digest('hex');
  const raw = '594f4d49' + hash.slice(8, 32);
  const chars = raw.split('');
  chars[12] = '7';
  const v = parseInt(chars[19], 16);
  chars[19] = ((v & 0x3) | 0x8).toString(16);
  return `${chars.slice(0,8).join('')}-${chars.slice(8,12).join('')}-${chars.slice(12,16).join('')}-${chars.slice(16,20).join('')}-${chars.slice(20,32).join('')}`;
}

interface RouteContext {
  params: Promise<{ chapterId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { chapterId } = await context.params;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const userId = demoUserId();
    const row = await db.query.readingProgress.findFirst({
      where: (f, { eq, and }) => and(eq(f.userId, userId), eq(f.chapterId, chapterId)),
    });
    if (!row) return Response.json({ progress: null }, { status: 200 });
    return Response.json({ progress: { pageNumber: row.pageNumber, scrollPosition: row.scrollPosition, completed: row.completed, updatedAt: row.updatedAt } }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}

export async function POST(request: Request, context: RouteContext) {
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
    const userId = demoUserId();
    // Verify chapter exists and get pageCount for clamp
    const chapter = await db.query.chapter.findFirst({ where: (f, { eq }) => eq(f.id, chapterId) });
    if (!chapter) return Response.json({ error: { code: 'CHAPTER_NOT_FOUND' } }, { status: 404 });
    const maxPage = chapter.pageCount ?? 1000;
    const clampedPage = Math.min(Math.max(1, pageNumber), maxPage);
    await db.insert(schema.readingProgress).values({
      userId,
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
    // Also ensure reading_history entry? Not needed for minimal
    return Response.json({ ok: true, pageNumber: clampedPage }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}
