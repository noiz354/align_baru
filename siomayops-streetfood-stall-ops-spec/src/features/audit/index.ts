/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Append-only audit (ADR-0026). The audit row is written in the SAME transaction as the business
 * change: if the audit cannot be written, the operation fails (INV-09). No application path may
 * update or delete an audit row (FR-AUDIT-007).
 */
export type AuditAction =
  | "shift.started" | "shift.suspended" | "shift.handover" | "shift.closed"
  | "location.reported" | "location.moved" | "location.status_changed"
  | "sale.created" | "sale.voided" | "sale.corrected"
  | "payment.recorded" | "payment.verified" | "payment.reconciled" | "payment.callback_rejected"
  | "expense.submitted" | "expense.reviewed" | "expense.rejected" | "expense.escalated" | "expense.flagged"
  | "stock.movement" | "stock.count_submitted" | "stock.transfer"
  | "price.policy_published" | "price.override_requested" | "price.override_applied" | "price.acknowledged"
  | "menu.item_upserted" | "menu.availability_changed"
  | "operator.created" | "operator.status_changed" | "operator.capabilities_changed" | "assignment.created"
  | "incident.submitted" | "incident.transitioned"
  | "loyalty.identified" | "loyalty.earned" | "loyalty.redeemed" | "loyalty.consent_withdrawn"
  | "authz.denied" | "auth.session_revoked" | "auth.device_revoked"
  | "config.changed" | "export.created" | "retention.executed";

export interface AuditEventInput {
  readonly organizationId: string;
  readonly actorKind: "OPERATOR" | "HQ_USER" | "SYSTEM" | "JOB";
  readonly actorId?: string;
  readonly action: AuditAction;
  readonly subjectKind: string;
  readonly subjectId: string;
  /** mandatory for corrections, voids, overrides, reconciliations, rejections (FR-AUDIT-002) */
  readonly reason?: string;
  readonly beforeSummary?: Readonly<Record<string, unknown>>;
  readonly afterSummary?: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly occurredAt: Date;
}

/** Requirements: FR-AUDIT-001..007. Task: T-FOUND-003. */
export async function writeAuditEvent(_event: AuditEventInput): Promise<void> {
  throw new Error("Not implemented: T-FOUND-003");
}

/** Requirements: FR-AUDIT-008. Task: T-FOUND-003. Read-only, scoped reconstruction of a shift. */
export async function reconstructShift(_input: {
  organizationId: string; shiftId: string;
}): Promise<readonly AuditEventInput[]> {
  throw new Error("Not implemented: T-FOUND-003");
}
