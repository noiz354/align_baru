/**
 * Audit writer - the only path that appends audit entries.
 *
 * Where this belongs: server/audit.
 * Specification: SECURITY.md §9, TASKS.md T-SEC-007, DATA_MODEL.md (append-only grants),
 *   docs/security/AUTHZ-MATRIX.md §4.5 (reason-required actions), ADR-0017 (tenancy).
 *
 * Invariants:
 *   1. Append-only: the application role has no UPDATE/DELETE on `audit_events`
 *      (drizzle/0002_audit_events.sql), and a trigger refuses mutation for any other role unless the
 *      documented repair switch is set.
 *   2. Tamper-evident: `hash` is sha256 over a canonical rendering of the entry INCLUDING `prev_hash`,
 *      and `(organization_id, chain_position)` is unique - so an edit, a gap or a reorder is detectable
 *      by `verifyAuditChain` in linear time.
 *   3. No forks: appends take a transaction-scoped advisory lock per organization and read the chain
 *      head `FOR UPDATE`, so concurrent writers cannot claim the same position.
 *   4. Same transaction: callers pass the transaction that owns the audited change, so a committed
 *      change cannot lack its audit entry, and a failed audit write rolls the change back (fail closed
 *      for security-relevant actions).
 *   5. Content: identifiers and metadata only. `reason` is the operator's own justification, which
 *      SECURITY.md §12 requires to be stored; tokens, contacts and transcript text are banned by name
 *      everywhere in telemetry (T-SEC-004) and never accepted here.
 *
 * Failure cases: no transaction and no connection -> throws (never a silent skip) · duplicate position
 * (unique index) -> throws, caller rolls back · missing organization -> foreign key violation -> throws.
 *
 * Task ownership: T-SEC-007 (delivered 2026-09-27). The scheduled verification job and the incident
 * alert route are T-OBS-003/T-SEC-010; `verifyAuditChain` is the function they will call.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { auditEvents } from "@/server/db/schema";
import { getDb, type DbHandle } from "@/server/db/client";
import type { AuditEntry } from "@/shared/contracts/audit";

/** Version tag inside the hashed payload: a chain must stay verifiable if the layout ever changes. */
const HASH_VERSION = 1;

export interface AuditWriteInput {
  readonly actionKey: string;
  readonly organizationId: string;
  readonly actorUserId?: string | undefined;
  readonly actorRole?: string | undefined;
  readonly scopeKind: string;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
  readonly reason?: string | undefined;
  readonly requestId?: string | undefined;
  /** Explicit timestamp; defaults to now. Supply it when the audited action has its own clock. */
  readonly occurredAt?: Date | undefined;
}

/**
 * Appends one entry to the organization's chain.
 *
 * @param input the entry to record
 * @param handle the transaction that owns the audited change (preferred) or any database handle
 * @throws Error when the append fails - the caller's transaction then rolls back (fail closed)
 */
export async function writeAuditEntry(input: AuditWriteInput, handle?: DbHandle): Promise<AuditEntry> {
  const db = handle ?? getDb();

  // Serialise appends per organization for the lifetime of this transaction. Without it two concurrent
  // requests would read the same head and one INSERT would fail on the unique index - correct, but it
  // turns a normal race into an error; the lock makes it a queue.
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.organizationId}, 0))`);

  const head = await db
    .select({ position: auditEvents.chainPosition, hash: auditEvents.hash })
    .from(auditEvents)
    .where(sql`${auditEvents.organizationId}::text = ${input.organizationId}`)
    .orderBy(sql`${auditEvents.chainPosition} DESC`)
    .limit(1)
    .for("update");

  const chainPosition = (head[0]?.position ?? 0) + 1;
  const prevHash = head[0]?.hash ?? null;
  const occurredAt = input.occurredAt ?? new Date();

  const hash = computeAuditHash({ input, chainPosition, prevHash, occurredAt });

  const inserted = await db
    .insert(auditEvents)
    .values({
      organizationId: input.organizationId,
      chainPosition,
      actionKey: input.actionKey,
      scopeKind: input.scopeKind,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      requestId: input.requestId,
      occurredAt,
      prevHash,
      hash,
    })
    .returning({
      id: auditEvents.id,
      occurredAt: auditEvents.occurredAt,
      chainPosition: auditEvents.chainPosition,
      prevHash: auditEvents.prevHash,
      hash: auditEvents.hash,
    });

  const row = inserted[0];
  if (!row) throw new Error("Audit append did not return the inserted row");

  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    chainPosition: row.chainPosition,
    prevHash: row.prevHash,
    hash: row.hash,
    actionKey: input.actionKey,
    scopeKind: input.scopeKind,
    organizationId: input.organizationId,
    ...(input.actorUserId === undefined ? {} : { actorUserId: input.actorUserId }),
    ...(input.actorRole === undefined ? {} : { actorRole: input.actorRole }),
    ...(input.targetType === undefined ? {} : { targetType: input.targetType }),
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  };
}

/** The fields that take part in the hash, in a fixed order. */
export interface AuditHashPayload {
  readonly input: AuditWriteInput;
  readonly chainPosition: number;
  readonly prevHash: string | null;
  readonly occurredAt: Date;
}

/**
 * sha256 over a canonical JSON rendering. Keys are written in a fixed order and `undefined` fields are
 * omitted entirely, so the same entry always hashes to the same value; `verifyAuditChain` recomputes it
 * from the stored row.
 */
export function computeAuditHash(payload: AuditHashPayload): string {
  const canonical: Record<string, string | number | null> = {
    v: HASH_VERSION,
    organizationId: payload.input.organizationId,
    chainPosition: payload.chainPosition,
    actionKey: payload.input.actionKey,
    scopeKind: payload.input.scopeKind,
    actorUserId: payload.input.actorUserId ?? null,
    actorRole: payload.input.actorRole ?? null,
    targetType: payload.input.targetType ?? null,
    targetId: payload.input.targetId ?? null,
    reason: payload.input.reason ?? null,
    requestId: payload.input.requestId ?? null,
    occurredAt: payload.occurredAt.toISOString(),
    prevHash: payload.prevHash,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
