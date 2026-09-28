import { createDb, closeDb } from '../../../../server/db/client';
import { loadEnv } from '../../../../shared/validation/env';
import * as schema from '../../../../server/db/schema';
import { getSessionUser } from '../../../../server/auth/guard';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ mangaId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401 });
  const { mangaId } = await params;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    await db.delete(schema.libraryEntry).where(and(eq(schema.libraryEntry.userId, user.id), eq(schema.libraryEntry.mangaId, mangaId)));
    return Response.json({ ok: true }, { status: 200 });
  } finally { await closeDb(db); }
}
