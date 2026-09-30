import { memoryStore, generateId } from "../../server/db/memory-store";

export type AuditAction =
  | "shift.started" | "shift.suspended" | "shift.handover" | "shift.closed"
  | "location.reported" | "location.gps_sample_saved" | "location.moved" | "location.status_changed"
  | "sale.created" | "sale.voided" | "sale.corrected"
  | "payment.recorded" | "payment.verified" | "payment.reconciled" | "payment.callback_rejected"
  | "expense.submitted" | "expense.reviewed" | "expense.rejected" | "expense.escalated" | "expense.flagged"
  | "stock.movement" | "stock.count_submitted" | "stock.transfer"
  | "price.policy_published" | "price.override_requested" | "price.override_applied" | "price.acknowledged"
  | "menu.item_upserted" | "menu.item_status_changed" | "menu.availability_changed"
  | "operator.created" | "operator.status_changed" | "operator.capabilities_changed" | "assignment.created"
  | "incident.submitted" | "incident.transitioned" | "incident.review_note_added" | "traffic.sample_recorded" | "site_condition.observation_saved"
  | "loyalty.identified" | "loyalty.earned" | "loyalty.redeemed" | "loyalty.consent_withdrawn"
  | "authz.denied" | "auth.session_revoked" | "auth.device_revoked"
  | "config.changed" | "export.created" | "retention.executed";

export interface AuditEventInput {
  readonly organizationId: string;
  readonly actorKind: "OPERATOR" | "HQ_USER" | "SYSTEM" | "JOB";
  readonly actorId?: string;
  readonly actorRole?: string;
  readonly action: AuditAction;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly reason?: string;
  readonly beforeSummary?: Readonly<Record<string, unknown>>;
  readonly afterSummary?: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly occurredAt: Date;
}

export async function writeAuditEvent(event: AuditEventInput): Promise<void> {
  // Append-only, no update/delete path
  const stored = {
    id: generateId(),
    organizationId: event.organizationId,
    actorId: event.actorId,
    actorKind: event.actorKind,
    actorRole: event.actorRole,
    action: event.action,
    entityType: event.subjectKind,
    entityId: event.subjectId,
    occurredAt: event.occurredAt,
    previousValueJson: event.beforeSummary ? JSON.stringify(event.beforeSummary) : undefined,
    newValueJson: event.afterSummary ? JSON.stringify(event.afterSummary) : undefined,
    reason: event.reason,
    requestId: event.correlationId,
  };
  memoryStore.auditEvents.push(stored as any);
}

export async function reconstructShift(input: {
  organizationId: string; shiftId: string;
}): Promise<readonly AuditEventInput[]> {
  const events = memoryStore.auditEvents.filter(e => e.organizationId === input.organizationId && e.entityId === input.shiftId);
  // Sort by occurredAt
  events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  return events.map(e => ({
    organizationId: e.organizationId,
    actorKind: e.actorKind as any,
    actorId: e.actorId,
    action: e.action as AuditAction,
    subjectKind: e.entityType,
    subjectId: e.entityId,
    reason: e.reason,
    beforeSummary: e.previousValueJson ? JSON.parse(e.previousValueJson) : undefined,
    afterSummary: e.newValueJson ? JSON.parse(e.newValueJson) : undefined,
    correlationId: e.requestId,
    occurredAt: e.occurredAt,
  }));
}

export function listAuditEvents(filter: { organizationId: string; entityType?: string; entityId?: string; actorId?: string }): typeof memoryStore.auditEvents {
  return memoryStore.auditEvents.filter(e => {
    if (e.organizationId !== filter.organizationId) return false;
    if (filter.entityType && e.entityType !== filter.entityType) return false;
    if (filter.entityId && e.entityId !== filter.entityId) return false;
    if (filter.actorId && e.actorId !== filter.actorId) return false;
    return true;
  });
}
