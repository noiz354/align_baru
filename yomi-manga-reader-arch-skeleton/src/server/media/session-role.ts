/**
 * server/media — the caller ROLE, for exactly one rule.
 *
 * Responsibility: answer "is this caller an admin?" for the `/media/{assetKey}`
 * draft rule (API_CONTRACT §2.1: "draft keys 404 for non-admins"). Nothing
 * else: no user id is returned, no private data is read, and a failure to
 * establish a role is always `false` (fail closed → 404).
 *
 * Requirements: API_CONTRACT §2.1 (authz row), NFR-SEC-002/003, ADR-006,
 * THREAT T-04/T-11.
 * Tasks: T-CATALOG-010 (the draft rule), INT-MEDIA-001.
 *
 * ── Why this module exists instead of `server/auth`'s Guard ───────────────
 * `server/auth/session-store.ts` owns the session store and the `Guard`
 * contract (`requireUser` / `requireAdmin`), and T-AUTH-006/007 implement it.
 * Neither has landed, and T-CATALOG-010 cannot ship a delivery route that
 * cannot answer its own authorization rule — so this is the narrow, real
 * read the rule needs (two indexed lookups: `ix_sessions_token`, then the
 * users PK), and it fails closed on anything unexpected.
 *
 * TODO(T-AUTH-007): replace this with `requireAdmin(ctx)` from the Guard. The
 * lookup shape is identical, so the swap is one line at the call site plus
 * this file's deletion — the media module must not grow its own identity
 * model in the meantime, and this file is the only place it does.
 *
 * Invariants:
 * - The cookie is the ONLY identity source. No user id is read from the URL,
 *   the query, or a header other than `Cookie` (THREAT T-04).
 * - Expired (idle or absolute) sessions are anonymous; a disabled user is
 *   never an admin (ADR-006 "status re-read per request").
 * - A malformed / absent / unknown token is `false`, never an error: an
 *   anonymous reader must see a plain 404, not a 403 (API_CONTRACT §1: role
 *   failures are 403, but this rule has no failure state for a reader).
 */
import type { Db } from '../db';

/** ADR-006: the cookie name is `yomi_session` (HttpOnly, Secure, Lax, Path=/). */
export const SESSION_COOKIE_NAME = 'yomi_session';

/**
 * A session token is 256-bit base64url (ADR-006 / DATA_MODEL §2). Bounding the
 * shape before it reaches the index is cheap and keeps a hostile 4 MB cookie
 * out of the query planner (NFR-PERF-014).
 */
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

/** Extracts the session token from a raw `Cookie` header, or `undefined`. */
export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined || cookieHeader === '') return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    const raw = part.slice(separator + 1).trim();
    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // A cookie that is not valid percent-encoding is not a session.
      return undefined;
    }
    return SESSION_TOKEN_PATTERN.test(value) ? value : undefined;
  }
  return undefined;
}

/**
 * True only for a live admin session.
 *
 * @param db the application handle.
 * @param cookieHeader the request's raw `Cookie` header (absent ⇒ anonymous).
 *
 * Requirements: API_CONTRACT §2.1, THREAT T-04. Task: T-CATALOG-010.
 */
export async function callerIsAdmin(db: Db, cookieHeader: string | undefined): Promise<boolean> {
  const token = readSessionToken(cookieHeader);
  if (token === undefined) return false;

  const session = await db.query.sessions.findFirst({
    where: (fields, { eq }) => eq(fields.sessionToken, token),
    columns: { userId: true, expiresAt: true, absoluteExpiresAt: true },
  });
  if (session === undefined) return false;

  // Both clocks are checked: idle expiry slides, absolute expiry does not.
  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return false;
  if (session.absoluteExpiresAt.getTime() <= now) return false;

  const user = await db.query.users.findFirst({
    where: (fields, { eq }) => eq(fields.id, session.userId),
    columns: { role: true, status: true },
  });
  return user !== undefined && user.role === 'admin' && user.status === 'active';
}
