import { createDb, closeDb } from '../../../../server/db/client';
import { loadEnv } from '../../../../shared/validation/env';
import { getSessionUser } from '../../../../server/auth/guard';
import { deleteLibraryEntry } from '../../../../server/db/queries/reader-state';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ mangaId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  const { mangaId } = await params;
  const db = await createDb(loadEnv());
  try {
    await deleteLibraryEntry(db, user.id, mangaId);
    return Response.json({ ok: true }, { status: 200 });
  } finally {
    await closeDb(db);
  }
}
