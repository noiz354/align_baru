/**
 * Audit contracts.
 * Specification: SECURITY.md §9, FR-AUDIT-001..005, RETENTION.md (audit 7 years).
 * Invariants:
 *   1. Append-only: the application role has no UPDATE/DELETE grant on audit tables.
 *   2. Tamper-evident: each entry stores a hash chain over the previous entry in its partition.
 *   3. Reason-required actions store a reason >= 8 characters (AUTHZ-MATRIX `✓*`).
 *   4. Audit entries store identifiers and metadata - never personal content or tokens.
 * Note on privacy: audit data is itself personal-adjacent (it reveals who acted). Access is narrow,
 *   audited, and its retention is documented.
 */
export interface AuditEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUserId?: string;
  readonly actorRole?: string;
  readonly actionKey: string;         // permission key or a documented system action
  readonly scopeKind: string;
  readonly organizationId: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly prevHash: string | null;
  readonly hash: string;
}
