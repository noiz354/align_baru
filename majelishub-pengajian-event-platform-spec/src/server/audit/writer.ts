/**
 * Audit writer - the only path that appends audit entries.
 *
 * Where this belongs: server/audit.
 * Specification: SECURITY.md §9, TASKS.md T-SEC-007, DATA_MODEL.md (append-only grants).
 * Invariants: append-only (the application role has no UPDATE/DELETE on audit tables); the hash chain
 *   is computed in the same transaction as the audited change, so a committed change cannot lack its
 *   audit entry; entries store references and metadata, never content or tokens; a security-relevant
 *   action fails closed if its audit write fails.
 * Concurrency: chain appends are serialised per organization partition (no forks).
 * Task ownership: T-SEC-007, T-AUDIT-001/002.
 */
import type { AuditEntry } from "@/shared/contracts/audit";

export interface AuditWriteInput {
  readonly actionKey: string;
  readonly organizationId: string;
  readonly actorUserId?: string;
  readonly actorRole?: string;
  readonly scopeKind: string;
  readonly targetType?: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly requestId?: string;
}

/** @throws Error("Not implemented: T-SEC-007") */
export async function writeAuditEntry(input: AuditWriteInput, tx?: import("@/server/db/client").DbTransaction): Promise<AuditEntry> {
  throw new Error("Not implemented: T-SEC-007");
}
