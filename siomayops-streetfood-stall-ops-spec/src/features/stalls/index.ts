import { memoryStore, generateId } from "../../server/db/memory-store";
import type { StallId, AreaId, SellingLocationId, OperatorId } from "../../shared/types/ids";
import type { AssignmentType } from "../../domain/operators";
import { assertAssignmentHasNoConflict } from "../../domain/operators/status";
import { writeAuditEvent } from "../audit";

export interface StallRecord {
  readonly stallId: StallId;
  readonly stallTypeId: string;
  readonly areaId: AreaId;
  readonly homeLocationId?: SellingLocationId;
  readonly status: "ACTIVE" | "MAINTENANCE" | "RETIRED" | "IN_TRANSIT";
  readonly organizationId: string;
  readonly code: string;
}

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function registerStall(input: {
  stallTypeId: string; areaId: AreaId; homeLocationId?: SellingLocationId; notes?: string; organizationId?: string; code?: string;
}): Promise<StallRecord> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const code = input.code || `ST-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = new Date();
  memoryStore.stalls.set(id, {
    id,
    organizationId: orgId,
    areaId: input.areaId,
    code,
    type: input.stallTypeId,
    status: "ACTIVE",
    createdAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    action: "assignment.created",
    subjectKind: "stall",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { type: input.stallTypeId, areaId: input.areaId },
  });
  return {
    stallId: id,
    stallTypeId: input.stallTypeId,
    areaId: input.areaId,
    homeLocationId: input.homeLocationId,
    status: "ACTIVE",
    organizationId: orgId,
    code,
  };
}

export async function changeStallStatus(input: {
  stallId: StallId; to: StallRecord["status"]; reason: string; overrideByUserId?: string; organizationId?: string;
}): Promise<StallRecord> {
  const stall = memoryStore.stalls.get(input.stallId);
  if (!stall) throw Object.assign(new Error("Stall not found"), { code: "NOT_FOUND" });
  const prev = stall.status;
  stall.status = input.to as any;
  memoryStore.stalls.set(stall.id, stall);
  await writeAuditEvent({
    organizationId: stall.organizationId,
    actorKind: "HQ_USER",
    actorId: input.overrideByUserId,
    action: "config.changed",
    subjectKind: "stall",
    subjectId: stall.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: input.to },
  });
  return {
    stallId: stall.id,
    stallTypeId: stall.type,
    areaId: stall.areaId,
    status: stall.status as any,
    organizationId: stall.organizationId,
    code: stall.code,
  };
}

export async function createAssignment(input: {
  operatorId: OperatorId; stallId: StallId; areaId: AreaId; type: AssignmentType;
  validFrom: Date; validTo?: Date; createdBy?: string; organizationId?: string;
}): Promise<{ readonly assignmentId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  const id = generateId();
  const candidate = {
    assignmentId: id,
    operatorId: input.operatorId,
    stallId: input.stallId,
    areaId: input.areaId,
    type: input.type,
    validFrom: input.validFrom,
    validTo: input.validTo,
    createdBy: input.createdBy || "system",
  };
  // Check conflicts
  const existing = Array.from(memoryStore.assignments.values())
    .filter(a => a.organizationId === orgId)
    .map(a => ({
      assignmentId: a.id,
      operatorId: a.operatorId,
      stallId: a.stallId,
      areaId: a.areaId,
      type: a.type as AssignmentType,
      validFrom: a.validFrom,
      validTo: a.validTo,
      createdBy: a.createdBy,
    }));
  assertAssignmentHasNoConflict(candidate as any, existing as any);

  memoryStore.assignments.set(id, {
    id,
    organizationId: orgId,
    operatorId: input.operatorId,
    stallId: input.stallId,
    areaId: input.areaId,
    type: input.type,
    validFrom: input.validFrom,
    validTo: input.validTo,
    createdBy: input.createdBy || "system",
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.createdBy,
    action: "assignment.created",
    subjectKind: "operator_assignment",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { operatorId: input.operatorId, stallId: input.stallId, type: input.type },
  });
  return { assignmentId: id };
}

export async function getStallById(stallId: string): Promise<StallRecord | null> {
  const s = memoryStore.stalls.get(stallId);
  if (!s) return null;
  return {
    stallId: s.id,
    stallTypeId: s.type,
    areaId: s.areaId,
    status: s.status as any,
    organizationId: s.organizationId,
    code: s.code,
  };
}
