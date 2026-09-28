import * as argon2 from 'argon2';
import { createDb, closeDb } from '../../../../server/db/client';
import { loadEnv } from '../../../../shared/validation/env';
import * as schema from '../../../../server/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: { code: 'VALIDATION_BAD_QUERY', message: 'Invalid JSON' } }, { status: 422 }); }
  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');
  if (!email || !password) {
    return Response.json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } }, { status: 401 });
  }
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const user = await db.query.users.findFirst({ where: (f,{eq})=>eq(f.email, email) });
    // uniform timing: dummy verify on unknown
    if (!user) {
      try { await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy', password); } catch {}
      return Response.json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } }, { status: 401 });
    }
    if (user.status === 'disabled') {
      return Response.json({ error: { code: 'AUTH_DISABLED', message: 'Account disabled' } }, { status: 403 });
    }
    let ok = false;
    try { ok = await argon2.verify(user.passwordHash, password); } catch { ok = false; }
    if (!ok) {
      return Response.json({ error: { code: 'AUTH_INVALID', message: 'Invalid credentials' } }, { status: 401 });
    }
    // create session
    const token = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30*24*3600*1000);
    const absoluteExpiresAt = new Date(now.getTime() + 30*24*3600*1000);
    await db.insert(schema.sessions).values({
      id: crypto.randomUUID(),
      userId: user.id,
      sessionToken: token,
      createdAt: now,
      expiresAt,
      absoluteExpiresAt,
      lastSeenAt: now,
    });
    // touch lastLogin
    await db.update(schema.users).set({ lastLoginAt: now }).where(eq(schema.users.id, user.id));
    const cookie = `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30*24*3600}`;
    // also set secure false for dev (pglite)
    return new Response(JSON.stringify({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName } }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': cookie }
    });
  } finally {
    await closeDb(db);
  }
}
