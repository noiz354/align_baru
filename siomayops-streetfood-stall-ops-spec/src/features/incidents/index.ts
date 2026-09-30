import type { SessionContext } from "../../server/auth/port";
import { getOperatorLocationContext } from "../locations";
import { memoryStore, generateId, type StoredIncident } from "../../server/db/memory-store";
import type { IncidentId, ShiftId, StallId, SellingLocationId } from "../../shared/types/ids";
import type { Scope } from "../../shared/types/scope";
import { INCIDENT_CATEGORIES, validateIncidentOccurredAt, type IncidentAmountContext, type IncidentCategoryCode, type IncidentSeverityHint } from "../../domain/incident";
import { writeAuditEvent } from "../audit";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = StoredIncident["status"];

const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  SUBMITTED: ["ACKNOWLEDGED", "INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"],
  ACKNOWLEDGED: ["INVESTIGATING", "ESCALATED", "RESOLVED", "CLOSED"],
  INVESTIGATING: ["ESCALATED", "RESOLVED", "CLOSED"],
  ESCALATED: ["ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const clientIncidentKey = (organizationId: string, operatorId: string, clientIncidentId: string) =>
  `${organizationId}|${operatorId}|${clientIncidentId}`;

function assertOperatorSelf(session: SessionContext): string {
  if (!session.roles.includes("OPERATOR") || !session.operatorId || session.scope.kind !== "self" ||
      session.scope.organizationId !== session.organizationId || session.scope.operatorId !== session.operatorId) {
    throw Object.assign(new Error("Operator self scope required"), { code: "FORBIDDEN", status: 403 });
  }
  return session.operatorId;
}

function serializeIncident(row: StoredIncident) {
  return {
    id: row.id,
    categoryCode: row.category,
    severityHint: row.severityHint ?? null,
    description: row.description,
    occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
    reportedAt: row.createdAt.toISOString(),
    amountMinor: row.amountMinor ?? null,
    amountContext: row.amountContext ?? null,
    locationName: row.sellingLocationId && memoryStore.sellingLocations.get(row.sellingLocationId)?.organizationId === row.organizationId
      ? memoryStore.sellingLocations.get(row.sellingLocationId)!.name : null,
    status: row.status,
  };
}

function currentOperatorIncidentContext(session: SessionContext, now: Date) {
  const operatorId = assertOperatorSelf(session);
  const locationContext = getOperatorLocationContext(session.scope, now);
  const shift = locationContext.activeShift ? memoryStore.shifts.get(locationContext.activeShift.shiftId) : undefined;
  return { operatorId, locationContext, shift };
}

export function getOperatorIncidentSubmissionContext(session: SessionContext, now = new Date()) {
  const { operatorId, locationContext, shift } = currentOperatorIncidentContext(session, now);
  return {
    operatorId,
    shiftId: shift?.id,
    stallId: shift?.stallId,
    sellingLocationId: locationContext.currentLocation?.sellingLocationId,
    locationName: locationContext.currentLocation?.name ?? null,
  };
}

export function getOperatorIncidentsPage(session: SessionContext, now = new Date()) {
  const { operatorId, locationContext } = currentOperatorIncidentContext(session, now);
  const context = locationContext;
  const operator = memoryStore.operators.get(operatorId);
  const reports = [...memoryStore.incidents.values()]
    .filter((incident) => incident.organizationId === session.organizationId && incident.operatorId === operatorId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, 10)
    .map(serializeIncident);

  return {
    generatedAt: now.toISOString(),
    environment: process.env.NODE_ENV === "production" ? "PRODUCTION" as const : "DEVELOPMENT" as const,
    operatorName: operator?.organizationId === session.organizationId ? operator.name : null,
    activeShift: context.activeShift ? {
      businessDay: context.activeShift.businessDay,
      stallCode: context.activeShift.stallCode,
    } : null,
    currentLocation: context.currentLocation ? {
      name: context.currentLocation.name,
      status: context.currentLocation.status,
    } : null,
    locationLinked: Boolean(context.activeShift && context.currentLocation),
    categories: INCIDENT_CATEGORIES,
    reports,
    evidenceUploadStatus: "UNSUPPORTED" as const,
  };
}

export function getOperatorIncident(session: SessionContext, incidentId: string) {
  const operatorId = assertOperatorSelf(session);
  const row = memoryStore.incidents.get(incidentId);
  if (!row || row.organizationId !== session.organizationId || row.operatorId !== operatorId) return null;
  return serializeIncident(row);
}

export async function submitIncident(input: {
  shiftId?: ShiftId;
  stallId?: StallId;
  sellingLocationId?: SellingLocationId;
  categoryId?: string;
  categoryCode?: IncidentCategoryCode;
  severity?: IncidentSeverity;
  severityHint?: IncidentSeverityHint;
  description: string;
  peopleInvolvedNote?: string;
  evidenceAssetIds?: readonly string[];
  clientIncidentId: string;
  recordedAtDevice?: Date;
  occurredAt?: Date;
  amountMinor?: number;
  amountContext?: IncidentAmountContext;
  operatorId?: string;
  organizationId?: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus; readonly replayed: boolean }> {
  if (!input.operatorId || !input.organizationId) {
    throw Object.assign(new Error("Incident reporter scope is required"), { code: "FORBIDDEN", status: 403 });
  }
  const orgId = input.organizationId;
  const category = input.categoryCode ?? input.categoryId;
  if (!category) throw Object.assign(new Error("Incident category is required"), { code: "VALIDATION_FAILED", status: 400 });
  const occurredAt = input.occurredAt ?? input.recordedAtDevice ?? new Date();
  if (!validateIncidentOccurredAt(occurredAt)) {
    throw Object.assign(new Error("Incident time cannot be more than five minutes in the future"), { code: "VALIDATION_FAILED", status: 400 });
  }
  if (input.shiftId) {
    const shift = memoryStore.shifts.get(input.shiftId);
    if (!shift || shift.organizationId !== orgId || shift.operatorId !== input.operatorId) {
      throw Object.assign(new Error("Incident shift is outside reporter scope"), { code: "FORBIDDEN", status: 403 });
    }
    if (input.sellingLocationId) {
      const location = memoryStore.sellingLocations.get(input.sellingLocationId);
      if (!location || location.organizationId !== orgId) {
        throw Object.assign(new Error("Incident location is outside organization scope"), { code: "FORBIDDEN", status: 403 });
      }
    }
  } else if (input.sellingLocationId) {
    throw Object.assign(new Error("A selling location cannot be linked without an active shift"), { code: "VALIDATION_FAILED", status: 400 });
  }

  const indexKey = clientIncidentKey(orgId, input.operatorId, input.clientIncidentId);
  const priorId = memoryStore.incidentByClientId.get(indexKey);
  if (priorId) {
    const prior = memoryStore.incidents.get(priorId);
    const same = prior && prior.category === category && prior.description === input.description &&
      prior.occurredAt?.getTime() === occurredAt.getTime() && prior.amountMinor === input.amountMinor &&
      prior.amountContext === input.amountContext && prior.severityHint === input.severityHint &&
      prior.shiftId === input.shiftId && prior.sellingLocationId === input.sellingLocationId;
    if (!same || !prior) {
      throw Object.assign(new Error("Client incident ID was already used for a different report"), { code: "CONFLICT", status: 409 });
    }
    return { incidentId: prior.id as IncidentId, status: prior.status, replayed: true };
  }

  const now = new Date();
  const id = generateId();
  const row: StoredIncident = {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    sellingLocationId: input.sellingLocationId,
    operatorId: input.operatorId,
    category,
    severityHint: input.severityHint,
    description: input.description,
    occurredAt,
    amountMinor: input.amountMinor,
    amountContext: input.amountContext,
    clientIncidentId: input.clientIncidentId,
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.incidents.set(id, row);
  memoryStore.incidentByClientId.set(indexKey, id);
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.operatorId,
    action: "incident.submitted",
    subjectKind: "incident",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: {
      category,
      status: row.status,
      severityHint: row.severityHint ?? null,
      amountReported: row.amountMinor !== undefined,
      evidenceAttached: false,
    },
  });
  return { incidentId: id as IncidentId, status: row.status, replayed: false };
}

function incidentAreaId(row: StoredIncident): string | undefined {
  const shift = row.shiftId ? memoryStore.shifts.get(row.shiftId) : undefined;
  if (shift?.organizationId === row.organizationId && shift.operatorId === row.operatorId) {
    const stall = memoryStore.stalls.get(shift.stallId);
    if (stall?.organizationId === row.organizationId) return stall.areaId;
  }
  const operator = memoryStore.operators.get(row.operatorId);
  return operator?.organizationId === row.organizationId ? operator.areaId : undefined;
}

function incidentStallCode(row: StoredIncident): string | null {
  const shift = row.shiftId ? memoryStore.shifts.get(row.shiftId) : undefined;
  if (!shift || shift.organizationId !== row.organizationId || shift.operatorId !== row.operatorId) return null;
  const stall = memoryStore.stalls.get(shift.stallId);
  return stall?.organizationId === row.organizationId ? stall.code : null;
}

function incidentLocationName(row: StoredIncident): string | null {
  if (!row.sellingLocationId) return null;
  const location = memoryStore.sellingLocations.get(row.sellingLocationId);
  if (!location || location.organizationId !== row.organizationId) return null;
  const areaId = incidentAreaId(row);
  if (areaId && location.areaId !== areaId) return null;
  return location.name;
}

function reviewerCanAccess(session: SessionContext, row: StoredIncident): boolean {
  if (!session.roles.some((role) => ["OWNER", "HQ_OPS", "AREA_SUPERVISOR"].includes(role))) return false;
  if (session.organizationId !== row.organizationId || session.scope.organizationId !== row.organizationId) return false;
  if (session.roles.includes("AREA_SUPERVISOR") && !session.roles.some((role) => role === "OWNER" || role === "HQ_OPS") && session.scope.kind !== "area") return false;
  if (session.scope.kind === "org") return true;
  const areaId = incidentAreaId(row);
  if (session.scope.kind === "area") return Boolean(areaId && areaId === session.scope.areaId);
  if (session.scope.kind === "stall") {
    const shift = row.shiftId ? memoryStore.shifts.get(row.shiftId) : undefined;
    return Boolean(shift?.organizationId === row.organizationId && shift.operatorId === row.operatorId && shift.stallId === session.scope.stallId);
  }
  return false;
}

function parseAuditSummary(value?: string): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function incidentHistory(incidentId: string, organizationId: string) {
  return memoryStore.auditEvents
    .filter((event) => event.organizationId === organizationId && event.entityType === "incident" && event.entityId === incidentId)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id))
    .slice(-50)
    .map((event) => {
      const before = parseAuditSummary(event.previousValueJson);
      const after = parseAuditSummary(event.newValueJson);
      const note = typeof after.followUpNote === "string" ? after.followUpNote
        : typeof after.resolutionNote === "string" ? after.resolutionNote
        : typeof after.note === "string" ? after.note : null;
      return {
        id: event.id,
        action: event.action,
        occurredAt: event.occurredAt.toISOString(),
        actorKind: event.actorKind,
        fromStatus: typeof before.status === "string" ? before.status : null,
        toStatus: typeof after.status === "string" ? after.status : null,
        note,
      };
    });
}

export function getIncidentReviewAllowedTransitions(status: IncidentStatus): readonly IncidentStatus[] {
  return INCIDENT_TRANSITIONS[status] ?? [];
}

function incidentCategoryLabel(code: string): string | null {
  return INCIDENT_CATEGORIES.find((category) => category.code === code)?.label ?? null;
}

export function getIncidentReviewDetail(session: SessionContext, incidentId: string) {
  const row = memoryStore.incidents.get(incidentId);
  if (!row || row.organizationId !== session.organizationId || !reviewerCanAccess(session, row)) return null;
  const operator = memoryStore.operators.get(row.operatorId);
  const safeOperator = operator?.organizationId === row.organizationId ? operator : undefined;
  return {
    id: row.id,
    categoryCode: row.category,
    categoryLabel: incidentCategoryLabel(row.category),
    description: row.description,
    status: row.status,
    severityHint: row.severityHint ?? null,
    amountMinor: row.amountMinor ?? null,
    amountContext: row.amountContext ?? null,
    occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
    reportedAt: row.createdAt.toISOString(),
    reporterName: safeOperator?.name ?? null,
    stallCode: incidentStallCode(row),
    locationName: incidentLocationName(row),
    evidence: { status: "UNSUPPORTED" as const, items: [] as const },
    reviewHistory: incidentHistory(row.id, row.organizationId),
    allowedNextStatuses: getIncidentReviewAllowedTransitions(row.status),
  };
}

export function getIncidentReviewInbox(session: SessionContext, limit = 100) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit) || 100));
  const incidents = [...memoryStore.incidents.values()]
    .filter((row) => row.organizationId === session.organizationId && reviewerCanAccess(session, row))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, boundedLimit);
  return {
    generatedAt: new Date().toISOString(),
    items: incidents.map((row) => {
      const operator = memoryStore.operators.get(row.operatorId);
      return {
        id: row.id,
        categoryCode: row.category,
        categoryLabel: incidentCategoryLabel(row.category),
        status: row.status,
        severityHint: row.severityHint ?? null,
        occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
        reportedAt: row.createdAt.toISOString(),
        reporterName: operator?.organizationId === row.organizationId ? operator.name : null,
        stallCode: incidentStallCode(row),
        locationName: incidentLocationName(row),
      };
    }),
  };
}

async function transitionIncident(input: {
  incidentId: IncidentId; to: IncidentStatus; followUpNote?: string; actorId: string; correlationId: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus; readonly fromStatus: IncidentStatus }> {
  const incident = memoryStore.incidents.get(input.incidentId);
  if (!incident) throw Object.assign(new Error("Incident not found"), { code: "NOT_FOUND", status: 404 });
  if (!(INCIDENT_TRANSITIONS[incident.status] ?? []).includes(input.to)) {
    throw Object.assign(new Error("Incident status transition is not allowed"), { code: "INVALID_TRANSITION", status: 409 });
  }
  if ((input.to === "RESOLVED" || input.to === "CLOSED") && !input.followUpNote) {
    throw Object.assign(new Error("A factual follow-up note is required for resolution or closure"), { code: "VALIDATION_FAILED", status: 400 });
  }
  const fromStatus = incident.status;
  const now = new Date();
  incident.status = input.to;
  incident.updatedAt = now;
  memoryStore.incidents.set(incident.id, incident);
  await writeAuditEvent({
    organizationId: incident.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    action: "incident.transitioned",
    subjectKind: "incident",
    subjectId: incident.id,
    correlationId: input.correlationId,
    occurredAt: now,
    beforeSummary: { status: fromStatus },
    afterSummary: { status: input.to, followUpNote: input.followUpNote },
  });
  return { incidentId: incident.id as IncidentId, status: incident.status, fromStatus };
}

export async function reviewIncident(input: {
  session: SessionContext;
  incidentId: string;
  toStatus?: IncidentStatus;
  note?: string;
  correlationId: string;
}): Promise<{ readonly status: IncidentStatus; readonly fromStatus?: IncidentStatus; readonly updatedAt: string }> {
  const incident = memoryStore.incidents.get(input.incidentId);
  if (!incident || incident.organizationId !== input.session.organizationId || !reviewerCanAccess(input.session, incident)) {
    throw Object.assign(new Error("Incident not found"), { code: "NOT_FOUND", status: 404 });
  }
  if (!input.toStatus && !input.note) {
    throw Object.assign(new Error("A status change or follow-up note is required"), { code: "VALIDATION_FAILED", status: 400 });
  }
  if (input.toStatus) {
    const result = await transitionIncident({
      incidentId: incident.id as IncidentId,
      to: input.toStatus,
      followUpNote: input.note,
      actorId: input.session.userId,
      correlationId: input.correlationId,
    });
    return { status: result.status, fromStatus: result.fromStatus, updatedAt: memoryStore.incidents.get(incident.id)!.updatedAt.toISOString() };
  }
  const now = new Date();
  await writeAuditEvent({
    organizationId: incident.organizationId,
    actorKind: "HQ_USER",
    actorId: input.session.userId,
    action: "incident.review_note_added",
    subjectKind: "incident",
    subjectId: incident.id,
    correlationId: input.correlationId,
    occurredAt: now,
    afterSummary: { note: input.note },
  });
  return { status: incident.status, updatedAt: now.toISOString() };
}

export async function listIncidents(orgId: string, status?: string): Promise<StoredIncident[]> {
  return [...memoryStore.incidents.values()]
    .filter((incident) => incident.organizationId === orgId && (!status || incident.status === status));
}
