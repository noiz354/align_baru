/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Data-subject rights and retention execution (ADR-0037, PRIVACY.md, RETENTION.md R-01…R-24).
 * Nothing here is implemented, and no retention job may run in this phase.
 */
export type DataSubjectRequestKind = "ACCESS" | "CORRECTION" | "DELETION" | "OBJECTION";

/** Requirements: NFR-PRIVACY-006, FR-OPERATOR-012, FR-LOYALTY-010. Task: T-OPS-001. */
export async function submitDataSubjectRequest(_input: {
  organizationId: string; subjectKind: "OPERATOR" | "CUSTOMER"; subjectReference: string;
  kind: DataSubjectRequestKind; notes?: string;
}): Promise<{ readonly requestId: string; readonly status: "RECEIVED" }> {
  throw new Error("Not implemented: T-OPS-001");
}

/** Requirements: FR-OPERATOR-010, NFR-PRIVACY-005. Task: T-OPS-001. */
export async function exportPersonalRecords(_input: {
  organizationId: string; subjectReference: string;
}): Promise<{ readonly exportAssetId: string; readonly expiresAt: Date }> {
  throw new Error("Not implemented: T-OPS-001");
}

/** Requirements: ADR-0037. Task: T-OPS-001. */
export async function runRetentionJob(_input: {
  organizationId: string; scheduledFor: Date;
}): Promise<{ readonly deletionsByClass: Readonly<Record<string, number>> }> {
  throw new Error("Not implemented: T-OPS-001");
}
