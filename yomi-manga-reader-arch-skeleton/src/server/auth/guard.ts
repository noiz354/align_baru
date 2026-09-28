import { createDb, closeDb } from '../db/client';
import { loadEnv } from '../../shared/validation/env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

function parseCookies(cookieHeader: string | null): Record<string,string> {
  if (!cookieHeader) return {};
  const out: Record<string,string> = {};
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export async function getSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies['session_token'] ?? request.headers.get('x-session-token');
  if (!token) return null;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const sess = await db.query.sessions.findFirst({ where: (f,{eq})=>eq(f.sessionToken, token) });
    if (!sess) return null;
    if (new Date(sess.expiresAt) < new Date()) return null;
    if (new Date(sess.absoluteExpiresAt) < new Date()) return null;
    const user = await db.query.users.findFirst({ where: (f,{eq})=>eq(f.id, sess.userId) });
    if (!user) return null;
    if (user.status !== 'active') return null;
    return { id: user.id, email: String(user.email), role: user.role, status: user.status };
  } finally {
    await closeDb(db);
  }
}

export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const u = await getSessionUser(request);
  if (!u) {
    throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED', status: 401 });
  }
  return u;
}
