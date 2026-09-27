/**
 * Session handling for organizers, volunteers, reviewers and platform staff.
 *
 * Where this belongs: server/auth. Participants do NOT have sessions - they hold a capability token
 * (registration access token) which is a different mechanism with narrower powers.
 * Specification: SECURITY.md §7, TASKS.md T-ORG-001, T-CHECKIN-016 (bound devices).
 * Invariants: sessions live in the database (a restart does not log anyone out); the rate limiter is
 *   backed by Postgres (the library's in-memory default is forbidden in production -
 *   docs/research/STACK-2026.md §6); idle timeout and revocation take effect on the next request;
 *   a check-in device session is bound to one event/entrance and cannot read other modules.
 * Failure cases: session store unavailable (fail closed for privileged actions) · expired session at a
 *   busy entrance (one-tap re-auth, local queue preserved) · concurrent sessions on one account
 *   (allowed, but listed and individually revocable).
 * Task ownership: T-ORG-001, T-CHECKIN-016, T-SEC-009 (passkeys/2FA for admin roles).
 */
import { headers } from "next/headers";

import { auth } from "@/server/auth/better-auth";
import { db } from "@/server/db/client";
import { deleteSessionById, listSessionsForUser, type StoredSession } from "@/server/db/repositories/sessions";

export interface SessionSummary {
  readonly sessionId: string;
  readonly userId: string;
  /**
   * Organization-scoped role keys held by this principal.
   *
   * Empty by design today: roles are a property of organization membership, which is T-ORG-002, and
   * the scope they resolve into is T-SEC-001. It is never a placeholder permission — an empty array
   * means "no role is known", and `requirePermission` (T-SEC-002) will deny on that basis.
   */
  readonly roles: readonly string[];
  readonly deviceLabel?: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

/**
 * Resolves the caller's session from the request cookies.
 *
 * Returns `null` for an anonymous caller — that is a normal outcome on public surfaces, not an error.
 * A database failure propagates: an unauthenticated-looking response caused by an outage would let a
 * privileged caller be treated as a stranger, and the correct behaviour for a privileged surface is
 * to fail closed.
 */
export async function getSession(): Promise<SessionSummary | null> {
  const result = await auth().api.getSession({ headers: await headers() });
  if (!result) return null;

  return {
    sessionId: result.session.id,
    userId: result.user.id,
    roles: [],
    createdAt: result.session.createdAt.toISOString(),
    lastSeenAt: result.session.updatedAt.toISOString(),
  };
}

/** Sessions belonging to the given user, newest first. Read-only; used by `/sesi-saya`. */
export async function listSessions(userId: string): Promise<readonly StoredSession[]> {
  return listSessionsForUser(db(), userId);
}

/**
 * Revokes one session immediately.
 *
 * SECURITY: this function performs **no** authorization of its own, deliberately: T-SEC-002 invariant 1
 * says no route, action or job performs its own role comparison, and `requirePermission` is the single
 * choke point. Callers must authorize first. No route or Server Action calls this yet — the surfaces
 * that will (`/sesi-saya`, the operator session-kill) are gated by T-SEC-002 before they ship.
 *
 * The `reason` is mandatory and validated, because SECURITY.md §12 records a session kill as an
 * audited action. **It is not persisted yet**: the audit trail is T-SEC-007, and inventing a partial
 * audit table here would give the next slice a second, conflicting audit path. The signature already
 * carries the reason so call sites do not change when T-SEC-007 writes it.
 *
 * @throws Error when the reason is too short, or when no such session exists.
 */
export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  if (reason.trim().length < 8) {
    throw new Error("a session revocation needs a reason of at least 8 characters");
  }

  const removed = await deleteSessionById(db(), sessionId);
  if (!removed) {
    // Not an authorization statement about another tenant's data — just "there is nothing to revoke".
    throw new Error(`session not found: ${sessionId}`);
  }
}
