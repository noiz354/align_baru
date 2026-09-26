/**
 * Audit hash chain (pure hashing over canonical entries).
 *
 * Where this belongs: `src/domain/audit/` - the hashing rule is a domain invariant; the storage and
 * permissions live in `src/server/audit/`.
 * Specification: SECURITY.md §9, FR-AUDIT-001/005, RETENTION.md (audit 7 years), THREAT_MODEL T-17.
 * Invariants:
 *   1. Entries are append-only; the chain is linear per organization partition (no forks - C-level
 *      concurrency concern).
 *   2. The hash covers the full canonical entry including `prevHash`, so any edit is detectable.
 *   3. Verification is linear and reports the first broken index.
 *   4. Audit entries never contain tokens or personal content (references only).
 * Task ownership: T-SEC-007.
 */
export interface AuditCanonicalInput {
  readonly occurredAt: string;
  readonly actorUserId?: string;
  readonly actionKey: string;
  readonly organizationId: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly prevHash: string | null;
}

export interface AuditChain {
  hashEntry(input: AuditCanonicalInput): string;
  verify(entries: readonly { readonly hash: string; readonly prevHash: string | null }[]): { ok: boolean; firstBrokenIndex?: number };
}

/** @throws Error("Not implemented: T-SEC-007") */
export function auditChain(): AuditChain {
  throw new Error("Not implemented: T-SEC-007");
}
