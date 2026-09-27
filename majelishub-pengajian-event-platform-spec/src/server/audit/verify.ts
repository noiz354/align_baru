/**
 * Audit chain verification - tamper evidence.
 *
 * Where this belongs: server/audit, next to the writer that produced the chain.
 * Specification: SECURITY.md §9, TASKS.md T-SEC-007 ("a verification job detects any break"),
 *   FR-AUDIT-002.
 *
 * The check is linear: one ordered pass, recomputing each hash and following `prev_hash`. It reports the
 * FIRST broken position and why, because the useful answer during an incident is "where did the record
 * stop being trustworthy", not a count.
 *
 * Detectable: an edited field (hash mismatch) · a deleted row (gap in `chain_position`, or a
 * `prev_hash` that points at nothing) · a reordered or re-hashed row (link mismatch) · a truncated tail
 * (the last position is not the row count) · a forged head (`prev_hash` NULL where it must not be).
 *
 * Not detectable by design: a rewrite of the ENTIRE chain by an actor with both the repair switch and
 * the database grants. That requires the migration/owner role, which is why the application role holds
 * only SELECT and INSERT (drizzle/0002_audit_events.sql) and why retention/export copies exist
 * (RETENTION.md).
 *
 * Failure cases: empty chain -> ok with 0 entries (nothing to break) · unreadable table -> throws (a
 * verifier that swallows errors would report a clean chain it never read).
 *
 * Task ownership: T-SEC-007 (delivered 2026-09-27). The scheduled job that calls this and the alert it
 * raises are T-OBS-003 / T-SEC-010.
 */
import { asc, eq } from "drizzle-orm";
import { auditEvents } from "@/server/db/schema";
import type { DbHandle } from "@/server/db/client";
import { computeAuditHash } from "@/server/audit/writer";

export interface AuditChainReport {
  readonly organizationId: string;
  readonly ok: boolean;
  /** Number of rows examined. */
  readonly entries: number;
  /** 1-based position of the first broken entry, when `ok` is false. */
  readonly brokenAtPosition?: number;
  readonly reason?: string;
}

interface ChainRow {
  chainPosition: number;
  actionKey: string;
  scopeKind: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  requestId: string | null;
  occurredAt: Date;
  prevHash: string | null;
  hash: string;
}

/**
 * Verifies an organization's audit chain.
 *
 * @throws Error when the table cannot be read - never reports "ok" for a chain it did not read
 */
export async function verifyAuditChain(handle: DbHandle, organizationId: string): Promise<AuditChainReport> {
  const rows = (await handle
    .select({
      chainPosition: auditEvents.chainPosition,
      actionKey: auditEvents.actionKey,
      scopeKind: auditEvents.scopeKind,
      actorUserId: auditEvents.actorUserId,
      actorRole: auditEvents.actorRole,
      targetType: auditEvents.targetType,
      targetId: auditEvents.targetId,
      reason: auditEvents.reason,
      requestId: auditEvents.requestId,
      occurredAt: auditEvents.occurredAt,
      prevHash: auditEvents.prevHash,
      hash: auditEvents.hash,
    })
    .from(auditEvents)
    .where(eq(auditEvents.organizationId, organizationId))
    .orderBy(asc(auditEvents.chainPosition))) as ChainRow[];

  let previousHash: string | null = null;

  for (const [index, row] of rows.entries()) {
    const expectedPosition = index + 1;
    if (row.chainPosition !== expectedPosition) {
      return broken(organizationId, rows.length, expectedPosition, `expected position ${expectedPosition}, found ${row.chainPosition}`);
    }
    if (row.prevHash !== previousHash) {
      return broken(organizationId, rows.length, row.chainPosition, "prev_hash does not link to the previous entry");
    }
    const recomputed = computeAuditHash({
      input: {
        organizationId,
        actionKey: row.actionKey,
        scopeKind: row.scopeKind,
        ...(row.actorUserId === null ? {} : { actorUserId: row.actorUserId }),
        ...(row.actorRole === null ? {} : { actorRole: row.actorRole }),
        ...(row.targetType === null ? {} : { targetType: row.targetType }),
        ...(row.targetId === null ? {} : { targetId: row.targetId }),
        ...(row.reason === null ? {} : { reason: row.reason }),
        ...(row.requestId === null ? {} : { requestId: row.requestId }),
        occurredAt: row.occurredAt,
      },
      chainPosition: row.chainPosition,
      prevHash: row.prevHash,
      occurredAt: row.occurredAt,
    });
    if (recomputed !== row.hash) {
      return broken(organizationId, rows.length, row.chainPosition, "stored hash does not match the entry content");
    }
    previousHash = row.hash;
  }

  return { organizationId, ok: true, entries: rows.length };
}

function broken(
  organizationId: string,
  entries: number,
  position: number,
  reason: string,
): AuditChainReport {
  return { organizationId, ok: false, entries, brokenAtPosition: position, reason };
}
