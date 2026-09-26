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
export interface SessionSummary {
  readonly sessionId: string;
  readonly userId: string;
  readonly roles: readonly string[];
  readonly deviceLabel?: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

/** @throws Error("Not implemented: T-ORG-001") */
export async function getSession(): Promise<SessionSummary | null> {
  throw new Error("Not implemented: T-ORG-001");
}

/** @throws Error("Not implemented: T-ORG-001") */
export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  throw new Error("Not implemented: T-ORG-001");
}
