import { createDb, closeDb } from '../../../server/db/client';
import { loadEnv } from '../../../shared/validation/env';
import { getSessionUser } from '../../../server/auth/guard';
import { readJsonBody } from '../../../shared/http/request-body';
import {
  findMangaById,
  findMangaBySlug,
  insertLibraryEntry,
  listLibraryEntries,
} from '../../../server/db/queries/reader-state';

export const dynamic = 'force-dynamic';

type AddToLibraryBody = { mangaId?: unknown; slug?: unknown };

/** GET /api/library → the signed-in user's shelf. */
export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  const db = await createDb(loadEnv());
  try {
    const rows = await listLibraryEntries(db, user.id);
    return Response.json({ items: rows, count: rows.length }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}

/** POST /api/library `{ mangaId }` or `{ slug }` → add, idempotently. */
export async function POST(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });

  const body = await readJsonBody<AddToLibraryBody>(request).catch(() => undefined);
  if (!body) return Response.json({ error: { code: 'VALIDATION_BAD_QUERY' } }, { status: 422 });

  const db = await createDb(loadEnv());
  try {
    // A slug is a convenience for a caller that only has the URL; the row is identified by id
    // either way, and the second lookup below is what proves the manga actually exists.
    let mangaId = typeof body.mangaId === 'string' ? body.mangaId : undefined;
    if (!mangaId && typeof body.slug === 'string') {
      const bySlug = await findMangaBySlug(db, body.slug);
      if (!bySlug) return Response.json({ error: { code: 'MANGA_NOT_FOUND' } }, { status: 404 });
      mangaId = bySlug.id;
    }
    if (!mangaId) {
      return Response.json(
        { error: { code: 'VALIDATION_BAD_QUERY', message: 'mangaId or slug required' } },
        { status: 422 },
      );
    }

    const manga = await findMangaById(db, mangaId);
    if (!manga) return Response.json({ error: { code: 'MANGA_NOT_FOUND' } }, { status: 404 });

    await insertLibraryEntry(db, {
      id: crypto.randomUUID(),
      userId: user.id,
      mangaId,
      status: 'reading',
      addedAt: new Date(),
    });
    return Response.json({ ok: true, mangaId }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}
