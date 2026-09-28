import { createDb, closeDb } from '../../../../server/db/client';
import { loadEnv } from '../../../../shared/validation/env';
import { eq } from 'drizzle-orm';
import * as schema from '../../../../server/db/schema';

export const dynamic = 'force-dynamic';

function parseCookies(header: string | null): Record<string,string> {
  if (!header) return {};
  const out: Record<string,string> = {};
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export async function POST(request: Request): Promise<Response> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const token = cookies['session_token'];
  if (token) {
    const env = loadEnv();
    const db = await createDb(env);
    try {
      await db.delete(schema.sessions).where(eq(schema.sessions.sessionToken, token));
    } finally {
      await closeDb(db);
    }
  }
  const cleared = `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': cleared } });
}
