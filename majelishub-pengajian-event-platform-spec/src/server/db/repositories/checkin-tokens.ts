/**
 * Check-in token repository - stores HASHES only.
 *
 * Where this belongs: server/db/repositories.
 * Specification: ADR-0006, docs/security/QR-SECURITY.md §1/§4, TASKS.md T-CHECKIN-003/011.
 * Invariants:
 *   1. There is NO plaintext token column (a schema test asserts this).
 *   2. Only `token_hash` (SHA-256) and a short display prefix are stored; lookups are by hash with
 *      constant-time comparison in the service layer.
 *   3. `UNIQUE (organization_id, token_hash)` prevents duplicates; revocation and expiry are columns,
 *      and expiry is evaluated server-side against the event window (venue timezone, ADR-0018).
 *   4. Token rows are retained 30 days after the event (RETENTION.md) - attendance outlives tokens.
 * Task ownership: T-CHECKIN-003/011, T-AUDIT-* (access events).
 */
export interface TokenRecord {
  readonly tokenHash: string;
  readonly displayPrefix: string;
  readonly registrationId: string;
  readonly eventId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly revokedReason?: string;
}

export interface CheckInTokenRepository {
  findByHash(eventId: string, tokenHash: string): Promise<TokenRecord | null>;
  issue(input: { registrationId: string; eventId: string; tokenHash: string; displayPrefix: string; expiresAt: string }): Promise<{ tokenId: string }>;
  revoke(input: { tokenId: string; reason: string; actorUserId: string }): Promise<void>;
  revokeAllForEvent(eventId: string, reason: string, actorUserId: string): Promise<number>;
}

/** @throws Error("Not implemented: T-CHECKIN-011") */
export function checkInTokenRepository(scope: import("@/shared/contracts/scope").TenantScope): CheckInTokenRepository {
  throw new Error("Not implemented: T-CHECKIN-011");
}
