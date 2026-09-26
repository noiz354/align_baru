/**
 * Short-lived token validation cache (optional optimisation, never a source of truth).
 *
 * Where this belongs: server/cache.
 * Specification: docs/security/QR-SECURITY.md §3, TASKS.md T-CHECKIN-001.
 * Invariants: TTL is short (seconds); entries are invalidated on revocation/cancellation; the cache
 *   NEVER stores a positive result across a window change; a miss is always a fresh database lookup;
 *   keys are hashes, never tokens.
 * Failure cases: cache unavailable (fall through to the database, never fail the request) · stale entry
 *   after revocation (bounded by the TTL - and the revocation path invalidates explicitly).
 * Task ownership: T-CHECKIN-001, T-PERF-002.
 */
export interface TokenLookupCache {
  get(eventId: string, tokenHash: string): Promise<{ registrationId: string; state: "ACTIVE" | "REVOKED" | "CANCELLED"; expiresAt: string } | null>;
  set(eventId: string, tokenHash: string, value: { registrationId: string; state: "ACTIVE" | "REVOKED" | "CANCELLED"; expiresAt: string }, ttlSeconds: number): Promise<void>;
  invalidate(eventId: string, tokenHash: string): Promise<void>;
}

/** @throws Error("Not implemented: T-CHECKIN-001") */
export function tokenLookupCache(): TokenLookupCache {
  throw new Error("Not implemented: T-CHECKIN-001");
}
