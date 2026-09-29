import { memoryStore, generateId } from "../../server/db/memory-store";
import type { IncidentId, ShiftId, StallId, SellingLocationId } from "../../shared/types/ids";
import { writeAuditEvent } from "../audit";

export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus =
  | "REPORTED" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";

// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  REPORTED: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
};

export async function submitIncident(input: {
  shiftId?: ShiftId; stallId?: StallId; sellingLocationId?: SellingLocationId; categoryId: string;
  severity: IncidentSeverity; description: string; peopleInvolvedNote?: string;
  evidenceAssetIds?: readonly string[]; clientIncidentId: string; recordedAtDevice?: Date;
  operatorId?: string; organizationId?: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const now = new Date();
  memoryStore.incidents.set(id, {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    operatorId: input.operatorId || "00000000-0000-0000-0000-000000000000",
    category: input.categoryId,
    description: input.description,
    status: "REPORTED" as any,
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.operatorId,
    action: "incident.submitted",
    subjectKind: "incident",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { category: input.categoryId, severity: input.severity },
  });
  return { incidentId: id, status: "REPORTED" };
}

export async function transitionIncident(input: {
  incidentId: IncidentId; to: IncidentStatus; reason?: string; resolutionNote?: string; actorId?: string;
}): Promise<{ readonly incidentId: IncidentId; readonly status: IncidentStatus }> {
  const inc = memoryStore.incidents.get(input.incidentId);
  if (!inc) throw Object.assign(new Error("Incident not found"), { code: "NOT_FOUND" });
  const allowed = INCIDENT_TRANSITIONS[inc.status as IncidentStatus];
  if (!allowed || !allowed.includes(input.to)) {
    throw Object.assign(new Error(`Invalid incident transition ${inc.status} -> ${input.to}`), { code: "INVALID_TRANSITION" });
  }
  const prev = inc.status;
  inc.status = input.to as any;
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

  return { incidentId: inc.id, status: input.to };
}

export async function listIncidents(orgId: string, status?: string): Promise<any[]> {
  const result = [];
  for (const inc of memoryStore.incidents.values()) {
    if (inc.organizationId !== orgId) continue;
    if (status && inc.status !== status) continue;
    result.push(inc);
  }
  return result;
}
