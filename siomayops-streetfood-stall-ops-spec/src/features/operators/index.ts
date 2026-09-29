import { memoryStore, generateId } from "../../server/db/memory-store";
import type { OperatorId, AreaId } from "../../shared/types/ids";
import type { OperatorStatus } from "../../domain/operators";
import { assertOperatorTransition } from "../../domain/operators/status";
import { writeAuditEvent } from "../audit";

export type { OperatorStatus };

export interface OperatorProfile {
  readonly operatorId: OperatorId;
  readonly fullName: string;
  readonly phoneNumberMasked: string;
  readonly phoneE164?: string;
  readonly areaId: AreaId;
  readonly status: OperatorStatus;
  readonly capabilityFlags: readonly string[];
  readonly organizationId: string;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return phone.slice(0, 3) + "****" + phone.slice(-2);
}

// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function registerOperator(input: {
  fullName: string; phoneNumber: string; areaId: AreaId; createdByUserId: string; organizationId?: string;
}): Promise<OperatorProfile> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Check unique phone per org
  for (const op of memoryStore.operators.values()) {
    if (op.organizationId === orgId && op.phoneE164 === input.phoneNumber) {
      throw Object.assign(new Error("Phone already exists"), { code: "CONFLICT" });
    }
  }
  const id = generateId();
  const now = new Date();
  memoryStore.operators.set(id, {
    id,
    organizationId: orgId,
    areaId: input.areaId,
    name: input.fullName,
    phoneE164: input.phoneNumber,
    status: "ACTIVE",
    contractType: "FULL_TIME",
    trainingState: "TRAINED",
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "HQ_USER",
    actorId: input.createdByUserId,
    action: "operator.created",
    subjectKind: "operator",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { name: input.fullName, phone: maskPhone(input.phoneNumber) },
  });
  return {
    operatorId: id,
    fullName: input.fullName,
    phoneNumberMasked: maskPhone(input.phoneNumber),
    phoneE164: input.phoneNumber,
    areaId: input.areaId,
    status: "ACTIVE",
    capabilityFlags: [],
    organizationId: orgId,
  };
}

export async function changeOperatorStatus(input: {
  operatorId: OperatorId; to: OperatorStatus; reason: string; actorId?: string; organizationId?: string;
}): Promise<OperatorProfile> {
  const op = memoryStore.operators.get(input.operatorId);
  if (!op) throw Object.assign(new Error("Operator not found"), { code: "NOT_FOUND" });
  assertOperatorTransition(op.status as OperatorStatus, input.to, input.reason);
  const prev = op.status;
  op.status = input.to;
  op.updatedAt = new Date();
  memoryStore.operators.set(op.id, op);
  await writeAuditEvent({
    organizationId: op.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId || "system",
    action: "operator.status_changed",
    subjectKind: "operator",
    subjectId: op.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: input.to },
  });
  return {
    operatorId: op.id,
    fullName: op.name,
    phoneNumberMasked: maskPhone(op.phoneE164),
    areaId: op.areaId,
    status: op.status as OperatorStatus,
    capabilityFlags: [],
    organizationId: op.organizationId,
  };
}

export async function setCapabilityFlags(input: {
  operatorId: OperatorId; flags: readonly string[]; reason: string; actorId?: string;
}): Promise<OperatorProfile> {
  const op = memoryStore.operators.get(input.operatorId);
  if (!op) throw Object.assign(new Error("Operator not found"), { code: "NOT_FOUND" });
  // Store flags in memoryStore as part of operator? We'll use a side map
  // For simplicity, attach to operator via custom property
  (op as any).capabilityFlags = input.flags;
  op.updatedAt = new Date();
  await writeAuditEvent({
    organizationId: op.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId || "system",
    action: "operator.capabilities_changed",
    subjectKind: "operator",
    subjectId: op.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { flags: input.flags },
  });
  return {
    operatorId: op.id,
    fullName: op.name,
    phoneNumberMasked: maskPhone(op.phoneE164),
    areaId: op.areaId,
    status: op.status as OperatorStatus,
    capabilityFlags: input.flags,
    organizationId: op.organizationId,
  };
}

export async function getOperatorById(operatorId: string): Promise<OperatorProfile | null> {
  const op = memoryStore.operators.get(operatorId);
  if (!op) return null;
  return {
    operatorId: op.id,
    fullName: op.name,
    phoneNumberMasked: maskPhone(op.phoneE164),
    phoneE164: op.phoneE164,
    areaId: op.areaId,
    status: op.status as OperatorStatus,
    capabilityFlags: (op as any).capabilityFlags || [],
    organizationId: op.organizationId,
  };
}

export async function listOperators(orgId: string): Promise<OperatorProfile[]> {
  const result: OperatorProfile[] = [];
  for (const op of memoryStore.operators.values()) {
    if (op.organizationId !== orgId) continue;
    result.push({
      operatorId: op.id,
      fullName: op.name,
      phoneNumberMasked: maskPhone(op.phoneE164),
      areaId: op.areaId,
      status: op.status as OperatorStatus,
      capabilityFlags: (op as any).capabilityFlags || [],
      organizationId: op.organizationId,
    });
  }
  return result;
}
