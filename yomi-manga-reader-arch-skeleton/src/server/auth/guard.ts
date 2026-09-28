/**
 * The session guard: cookie in, verified user out.
 *
 * This is the ONLY place a request's identity is established, and it is the
 * third of the three database connections F-001-S1 set out to remove. It used to
 * call `createDb` and `closeDb` on every single call, so one members' request
 * holding a session cost three pools: one for the catalog root, one for the
 * library root, and one here, opened and torn down per call.
 *
 * It now takes the process-wide handle. Two ways to do that, and the choice
 * matters:
 *
 * - A REQUIRED `db` parameter would make the dependency explicit, but every
 *   caller would have to acquire a handle, and three call sites would each grow a
 *   try/finally around it. The dependency is a *pool*, and the pool is a process
 *   singleton; making callers manage its lifetime buys explicitness at the cost
 *   of three chances to leak it.
 * - An OPTIONAL parameter that falls back to the shared handle keeps the signature
 *   honest (production can always just pass a request) while making injection
 *   possible for a test or a future composition root.
 *
 * The second was chosen, with the trade-off written down rather than left implicit.
 * F-002 replaces this file's body with a `SessionRepository` lookup, at which
 * point the pool is threaded by the repository and this signature stops mattering.
 *
 * ── Known debt, deliberately not fixed here ─────────────────────────────────
 * - `requireUser` throws a bare `Error` with a `code` property stapled on, not an
 *   `AppError` (ERROR_MODEL rule 1: a bare throw reaching a client is a defect).
 *   → F-002
 * - The `x-session-token` header is accepted as a fallback. A token in a header
 *   lands in access logs, proxy logs and `Referer`; a cookie does not. Kept
 *   because some test harness depends on it, and removing it blind would break
 *   them. → F-002 decides, with a decision recorded either way.
 * - This file bypasses the `SessionRepository` port entirely, which is one of the
 *   three disagreeing session implementations. `session-store.ts` throws
 *   `T-AUTH-006` and the auth routes use `queries/reader-state.ts`. → F-002
 *
 * Requirements: FR-AUTH-003, NFR-SEC-016, NFR-PERF-014
 * Tasks: T-AUTH-007; debt F-002
 */
import { acquireDb, releaseDb, type Db } from '../db/client';
import { loadEnv } from '../../shared/validation/env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

/**
 * Resolve the session behind a request, or `null` when there is none or it is
 * unusable.
 *
 * `null` is deliberately overloaded across five different causes — no cookie, no
 * such session, idle expiry, absolute expiry, and a non-active user. That is not
 * laziness: distinguishing them would tell an attacker whether a session id ever
 * existed. All five answer the same way, and the *caller* decides whether that is
 * a 401 or an anonymous view.
 *
 * The two expiry checks are not redundant. `expiresAt` slides with activity;
 * `absoluteExpiresAt` does not, so a session cannot be kept alive forever by
 * continuing to use it.
 *
 * @param request the incoming request
 * @param db an existing handle to use; omit to share the process-wide one
 * @returns the verified user, or `null`
 */
export async function getSessionUser(request: Request, db?: Db): Promise<AuthenticatedUser | null> {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const token = cookies['session_token'] ?? request.headers.get('x-session-token');
  if (!token) return null;

  // Acquired only when a token is actually present, so an anonymous request — the
  // common case on /discover, /search and the reader — never touches the pool from
  // this path at all.
  const owned = db === undefined;
  const handle = owned ? await acquireDb(loadEnv()) : db;
  try {
    const sess = await handle.query.sessions.findFirst({
      where: (f, { eq }) => eq(f.sessionToken, token),
    });
    if (!sess) return null;
    if (new Date(sess.expiresAt) < new Date()) return null;
    if (new Date(sess.absoluteExpiresAt) < new Date()) return null;
    const user = await handle.query.users.findFirst({
      where: (f, { eq }) => eq(f.id, sess.userId),
    });
    if (!user) return null;
    if (user.status !== 'active') return null;
    return { id: user.id, email: String(user.email), role: user.role, status: user.status };
  } finally {
    if (owned) await releaseDb(handle);
  }
}

/**
 * As {@link getSessionUser}, but for callers that cannot proceed anonymously.
 *
 * Throws a bare `Error` with a `code` property, which is NOT an `AppError` and
 * does not satisfy ERROR_MODEL rule 1. Recorded rather than quietly fixed: the
 * three call sites in `app/api/*` each translate this into their own 401, so
 * changing the thrown type changes their behaviour and belongs with F-002, where
 * the port becomes the single authority. → F-002
 *
 * @param request the incoming request
 * @param db an existing handle to use; omit to share the process-wide one
 * @returns the verified user
 * @throws when there is no usable session
 */
export async function requireUser(request: Request, db?: Db): Promise<AuthenticatedUser> {
  const u = await getSessionUser(request, db);
  if (!u) {
    throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED', status: 401 });
  }
  return u;
}
