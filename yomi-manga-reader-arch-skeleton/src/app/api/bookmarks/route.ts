import { createDb, closeDb } from '../../../server/db/client';
import { loadEnv } from '../../../shared/validation/env';
import * as schema from '../../../server/db/schema';
import { getSessionUser } from '../../../server/auth/guard';

/**
 * Request bodies are untrusted, so a field is only treated as a string when it really is one.
 * `String(value)` would accept anything and stringify objects into "[object Object]", which
 * then reads as a valid id.
 */
function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const dynamic = 'force-dynamic';

// GET /api/bookmarks → list for user
export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const rows = await db.query.bookmark.findMany({ where: (f,{eq})=>eq(f.userId, user.id) });
    return Response.json({ items: rows, count: rows.length }, { status: 200 });
  } finally { await closeDb(db); }
}

// POST /api/bookmarks { chapterId, pageNumber, note? }
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  // The parsed request body is untrusted input, so it is typed by the fields this handler
  // reads rather than asserted to `any`; each field is then coerced explicitly below.
  let body: { chapterId?: unknown; pageNumber?: unknown; note?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: { code: 'VALIDATION_BAD_QUERY' } }, { status: 422 }); }
  const chapterId = asString(body?.chapterId).trim();
  const pageNumber = body?.pageNumber === null ? null : Number(body?.pageNumber);
  const note = asString(body?.note).slice(0, 280);
  if (!chapterId) return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'chapterId required' } }, { status: 422 });
  if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1)) {
    return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'Invalid pageNumber' } }, { status: 422 });
  }
  const env = loadEnv();
  const db = await createDb(env);
  try {
    // verify chapter exists (optional)
    const chapter = await db.query.chapter.findFirst({ where: (f,{eq})=>eq(f.id, chapterId) });
    if (!chapter) return Response.json({ error: { code: 'CHAPTER_NOT_FOUND' } }, { status: 404 });
    if (pageNumber !== null && chapter.pageCount && pageNumber > chapter.pageCount) {
      return Response.json({ error: { code: 'READER_INVALID_PAGE', message: 'page out of range' } }, { status: 422 });
    }
    const id = crypto.randomUUID();
    try {
      const [row] = await db.insert(schema.bookmark).values({
        id,
        userId: user.id,
        chapterId,
        pageNumber,
        note,
      }).returning();
      return Response.json({ bookmark: row }, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('ix_bookmarks_user_chapter_page') || msg.includes('duplicate') || msg.includes('unique')) {
        return Response.json({ error: { code: 'LIBRARY_BOOKMARK_EXISTS', message: 'Bookmark exists' } }, { status: 409 });
      }
      throw e;
    }
  } finally { await closeDb(db); }
}
