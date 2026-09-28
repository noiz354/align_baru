/**
 * POST /api/auth/logout — revoke the session and clear the cookie.
 *
 * The cookie is cleared with attributes MATCHING the one set at login, because a
 * `Set-Cookie` that differs in `path`, `secure` or `httpOnly` leaves the original
 * in place and the browser keeps sending it. That is a quiet failure — logout
 * appears to work and the token stays valid.
 *
 * Same known debt as the login route: session storage is reached through
 * `queries/reader-state.ts` rather than the `SessionRepository` port, whose
 * implementation throws `T-AUTH-006`, and the handle is opened per request. →
 * F-001, F-002
 *
 * Revocation is by token, so it is immediate. There is no `revokeAll` path for
 * "sign out everywhere"; the port declares one and nothing calls it.
 *
 * Requirements: FR-AUTH-003, NFR-SEC-016
 * Tasks: T-AUTH-004; debt F-001, F-002
 */
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
