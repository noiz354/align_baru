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

export async function transitionIncident(input: {
  incidentId: IncidentId; to: IncidentStatus; reason?: string; resolutionNote?: string; actorId?: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus }> {
  const inc = memoryStore.incidents.get(input.incidentId);
  if (!inc) throw Object.assign(new Error("Incident not found"), { code: "NOT_FOUND" });
  const allowed = INCIDENT_TRANSITIONS[inc.status];
  if (!allowed.includes(input.to)) {
    throw Object.assign(new Error(`Invalid incident transition ${inc.status} -> ${input.to}`), { code: "INVALID_TRANSITION" });
  }
  const prev = inc.status;
  inc.status = input.to;
  inc.updatedAt = new Date();
  memoryStore.incidents.set(inc.id, inc);

  await writeAuditEvent({
    organizationId: inc.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    action: "incident.transitioned",
    subjectKind: "incident",
    subjectId: inc.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: input.to, resolutionNote: input.resolutionNote },
  });

  return { incidentId: inc.id as IncidentId, status: input.to };
}

export async function listIncidents(orgId: string, status?: string): Promise<StoredIncident[]> {
  return [...memoryStore.incidents.values()]
    .filter((incident) => incident.organizationId === orgId && (!status || incident.status === status));
}
