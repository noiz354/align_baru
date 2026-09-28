/**
 * Session handling for organizers, volunteers, reviewers and platform staff.
 *
 * Where this belongs: server/auth. Participants do NOT have sessions - they hold a capability token
 * (registration access token) which is a different mechanism with narrower powers.
 * Specification: SECURITY.md §2/§10/§12, ADR-0005, TASKS.md T-ORG-001, T-CHECKIN-016 (bound devices).
 *
 * Invariants implemented (T-ORG-001):
 *   1. Sessions live in the database (`sessions`), so a restart or a deploy logs nobody out and a
 *      revocation survives the process.
 *   2. `getSession()` never trusts client state: it asks the identity library, which reads the session
 *      row and its expiry. The cookie cache is disabled in `auth.ts`.
 *   3. Roles are NOT taken from the session payload; they are read from `organization_members` on every
 *      call, so a role change takes effect on the next request (SECURITY.md §2, AUTHZ-MATRIX §4).
 *   4. Revocation is an audited action with a reason of at least 8 characters (SECURITY.md §12:
 *      authorization changes record actor, target, reason).
 *   5. No token value is returned, logged or echoed (SECURITY.md §11).
 *
 * Failure cases: identity store unavailable -> the error propagates and the caller fails closed for
 * privileged actions · expired session -> null, which the caller turns into 401 · unknown session id on
 * revocation -> NOT_FOUND (no existence disclosure) · concurrent sessions on one account are allowed and
 * individually revocable (SECURITY.md §2).
 *
 * Task ownership: T-ORG-001 (delivered 2026-09-27). Device-bound check-in sessions are T-CHECKIN-016;
 * passkeys/2FA for administrative roles are T-SEC-009; the durable audit row is T-SEC-007.
 */
import { eq } from "drizzle-orm";
import { sessions } from "@/server/db/schema";
import { getDb, isPGliteDb, type DbHandle } from "@/server/db/client";
import { AppError } from "@/shared/contracts/errors";
import { auth } from "@/server/auth/auth";
import { listActiveMembershipsForUser } from "@/server/db/repositories/organizations";
import { buildSecurityEvent, recordSecurityEvent } from "@/server/auth/authorization-events";

export interface SessionSummary {
  readonly sessionId: string;
  readonly userId: string;
  /** Distinct role keys across the user's ACTIVE memberships. Empty means: no scope, no access. */
  readonly roles: readonly string[];
  readonly deviceLabel?: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

/** Minimum length for a recorded reason (AUTHZ-MATRIX §4.5). */
const MIN_REASON_LENGTH = 8;

/**
 * Read the current session for a request.
 *
 * @param headers the incoming request headers (the session cookie lives there)
 * @returns null when there is no valid session - the caller answers 401, never a default identity
 */
export async function getSession(headers: Headers, handle?: DbHandle): Promise<SessionSummary | null> {
  let result: Awaited<ReturnType<ReturnType<typeof auth>["api"]["getSession"]>>;
  try {
    result = await auth().api.getSession({ headers });
  } catch (error) {
    // Better Auth's runtime adapter intentionally uses the PostgreSQL pool; the local PGlite fallback
    // has no identity adapter. Fail closed as an unauthenticated request instead of surfacing a 500 or
    // trusting caller-supplied identity headers. Production PostgreSQL still takes the normal path.
    if (isPGliteDb()) return null;
    throw error;
  }
  if (!result?.session || !result.user) return null;

  const memberships = await listActiveMembershipsForUser(handle ?? getDb(), result.user.id);
  const roles = [...new Set(memberships.flatMap((membership) => membership.roles))].sort();

  const summary: SessionSummary = {
    sessionId: result.session.id,
    userId: result.user.id,
    roles,
    createdAt: toIso(result.session.createdAt),
    lastSeenAt: toIso(result.session.updatedAt),
  };
  const deviceLabel = (result.session as { deviceLabel?: string | null }).deviceLabel;
  return deviceLabel ? { ...summary, deviceLabel } : summary;
}

/**
 * Revoke one session.
 *
 * The session row is deleted, which ends the session on its next request (SECURITY.md §2). The action
 * requires an actor and a reason because it is an authorization change and must be reconstructable from
 * the audit trail (SECURITY.md §12); the durable audit row is written by T-SEC-007 - until then the
 * event is emitted through the security-event sink.
 *
 * @throws AppError(NOT_FOUND) when the session does not exist (no existence disclosure)
 * @throws AppError(VALIDATION_FAILED) when the reason is shorter than 8 characters
 */
export async function revokeSession(
  sessionId: string,
  reason: string,
  context: { actorUserId: string; organizationId: string },
  handle: DbHandle = getDb(),
): Promise<void> {
  if (reason.trim().length < MIN_REASON_LENGTH) {
    throw AppError.validation("Alasan pembatalan sesi minimal 8 karakter.");
  }

  const deleted = await handle.delete(sessions).where(eq(sessions.id, sessionId)).returning({ id: sessions.id });
  if (deleted.length === 0) throw AppError.notFound("Sesi tidak ditemukan.");

  recordSecurityEvent(
    buildSecurityEvent({
      event: "session_revoked",
      sessionId,
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      reason: reason.trim(),
      now: new Date(),
    }),
  );
}

function toIso(value: Date | string | undefined): string {
  if (value === undefined) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
