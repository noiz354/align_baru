import { memoryStore, generateId } from "../../server/db/memory-store";
import { writeAuditEvent } from "../audit";

export type DataSubjectRequestKind = "ACCESS" | "CORRECTION" | "DELETION" | "OBJECTION";

interface DataSubjectRequest {
  id: string;
  organizationId: string;
  subjectKind: "OPERATOR" | "CUSTOMER";
  subjectReference: string;
  kind: DataSubjectRequestKind;
  notes?: string;
  status: "RECEIVED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: Date;
}

const requests = new Map<string, DataSubjectRequest>();

export async function submitDataSubjectRequest(input: {
  organizationId: string; subjectKind: "OPERATOR" | "CUSTOMER"; subjectReference: string;
  kind: DataSubjectRequestKind; notes?: string;
}): Promise<{ readonly requestId: string; readonly status: "RECEIVED" }> {
  const id = generateId();
  const req: DataSubjectRequest = {
    id,
    organizationId: input.organizationId,
    subjectKind: input.subjectKind,
    subjectReference: input.subjectReference,
    kind: input.kind,
    notes: input.notes,
    status: "RECEIVED",
    createdAt: new Date(),
  };
  requests.set(id, req);
  await writeAuditEvent({
    organizationId: input.organizationId,
    actorKind: "HQ_USER",
    action: "retention.executed",
    subjectKind: "data_subject_request",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: { kind: input.kind, subjectKind: input.subjectKind },
  });
  return { requestId: id, status: "RECEIVED" };
}

export async function exportPersonalRecords(input: {
  organizationId: string; subjectReference: string;
}): Promise<{ readonly exportAssetId: string; readonly expiresAt: Date }> {
  const exportId = generateId();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  // Simulate export: collect operator data
  const operator = memoryStore.operators.get(input.subjectReference);
  const data = operator ? { id: operator.id, name: operator.name, phone: "***masked***", areaId: operator.areaId } : {};
  await writeAuditEvent({
    organizationId: input.organizationId,
    actorKind: "HQ_USER",
    action: "export.created",
    subjectKind: "personal_export",
    subjectId: exportId,
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: data,
  });
  return { exportAssetId: exportId, expiresAt };
}

export async function runRetentionJob(input: {
  organizationId: string; scheduledFor: Date;
}): Promise<{ readonly deletionsByClass: Readonly<Record<string, number>> }> {
  // Simulate retention: count deletable records older than policy
  // For demo, return zero deletions
  const deletions: Record<string, number> = {
    audit_events: 0,
    loyalty_accounts: 0,
    incidents: 0,
    expenses_evidence: 0,
  };
  await writeAuditEvent({
    organizationId: input.organizationId,
    actorKind: "JOB",
    action: "retention.executed",
    subjectKind: "retention_job",
    subjectId: generateId(),
    correlationId: generateId(),
    occurredAt: new Date(),
    afterSummary: deletions,
  });
  return { deletionsByClass: deletions };
}
