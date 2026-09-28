import { createDb, closeDb } from '../../../server/db/client';
import { loadEnv } from '../../../shared/validation/env';
import { getSessionUser } from '../../../server/auth/guard';
import { readJsonBody } from '../../../shared/http/request-body';
import { findChapterById, insertBookmark, listBookmarks } from '../../../server/db/queries/reader-state';

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
    const rows = await listBookmarks(db, user.id);
    return Response.json({ items: rows, count: rows.length }, { status: 200 });
  } finally { await closeDb(db); }
}

// POST /api/bookmarks { chapterId, pageNumber, note? }
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  // The parsed request body is untrusted input, so it is typed by the fields this handler
  // reads rather than asserted to `any`; each field is then coerced explicitly below.
  const body = await readJsonBody<{ chapterId?: unknown; pageNumber?: unknown; note?: unknown }>(request)
    .catch(() => undefined);
  if (!body) return Response.json({ error: { code: 'VALIDATION_BAD_QUERY' } }, { status: 422 });
  const chapterId = asString(body.chapterId).trim();
  const pageNumber = body.pageNumber === null ? null : Number(body.pageNumber);
  const note = asString(body.note).slice(0, 280);
  if (!chapterId) return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'chapterId required' } }, { status: 422 });
  if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1)) {
    return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'Invalid pageNumber' } }, { status: 422 });
  }
  const env = loadEnv();
  const db = await createDb(env);
  try {
    // A bookmark pointing at a chapter that does not exist is not a bookmark, so the chapter
    // is resolved before the insert rather than trusted from the request.
    const chapter = await findChapterById(db, chapterId);
    if (!chapter) return Response.json({ error: { code: 'CHAPTER_NOT_FOUND' } }, { status: 404 });
    if (pageNumber !== null && chapter.pageCount && pageNumber > chapter.pageCount) {
      return Response.json({ error: { code: 'READER_INVALID_PAGE', message: 'page out of range' } }, { status: 422 });
    }
    try {
      const row = await insertBookmark(db, {
        id: crypto.randomUUID(),
        userId: user.id,
        chapterId,
        pageNumber,
        note,
      });
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
