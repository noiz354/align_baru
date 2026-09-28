import { createDb, closeDb } from '../../../server/db/client';
import { loadEnv } from '../../../shared/validation/env';
import * as schema from '../../../server/db/schema';
import { getSessionUser } from '../../../server/auth/guard';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/library → list for authenticated user
export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const rows = await db.query.libraryEntry.findMany({ where: (f,{eq})=>eq(f.userId, user.id) });
    return Response.json({ items: rows, count: rows.length }, { status: 200 });
  } finally { await closeDb(db); }
}

// POST /api/library { mangaId or slug } → add idempotent
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: { code: 'VALIDATION_BAD_QUERY' } }, { status: 422 }); }
  let mangaId = body?.mangaId as string | undefined;
  const slug = body?.slug as string | undefined;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    if (!mangaId && slug) {
      const m = await db.query.manga.findFirst({ where: (f,{eq})=>eq(f.slug, slug) });
      if (!m) return Response.json({ error: { code: 'MANGA_NOT_FOUND' } }, { status: 404 });
      mangaId = m.id;
    }
    if (!mangaId) return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'mangaId or slug required' } }, { status: 422 });
    const manga = await db.query.manga.findFirst({ where: (f,{eq})=>eq(f.id, mangaId!) });
    if (!manga) return Response.json({ error: { code: 'MANGA_NOT_FOUND' } }, { status: 404 });
    await db.insert(schema.libraryEntry).values({
      userId: user.id,
      mangaId: mangaId!,
      addedAt: new Date(),
    }).onConflictDoNothing();
    return Response.json({ ok: true, mangaId }, { status: 200 });
  } finally { await closeDb(db); }
}
