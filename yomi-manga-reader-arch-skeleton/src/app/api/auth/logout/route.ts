import { createDb, closeDb } from '../../../../server/db/client';
import { loadEnv } from '../../../../shared/validation/env';
import { deleteSessionByToken } from '../../../../server/db/queries/reader-state';

export const dynamic = 'force-dynamic';

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export async function POST(request: Request): Promise<Response> {
  const token = parseCookies(request.headers.get('cookie'))['session_token'];
  if (token) {
    const db = await createDb(loadEnv());
    try {
      await deleteSessionByToken(db, token);
    } finally {
      await closeDb(db);
    }
  }
  // The cookie is cleared whether or not a session row existed: logout is idempotent, and a
  // stale cookie in the browser is the thing that actually keeps a user signed in.
  const cleared = 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cleared },
  });
}
