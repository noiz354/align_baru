/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Evidence storage via the S3-compatible API with short-lived pre-signed URLs (ADR-0020).
 * Evidence is optional, access-controlled, and deleted on the retention schedule (R-06/R-12).
 */
export interface PresignUploadInput {
  readonly organizationId: string;
  readonly subjectKind: "EXPENSE" | "INCIDENT" | "STOCK" | "PAYMENT_EVIDENCE";
  readonly subjectId: string;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  readonly maxBytes: number;
}

export interface EvidenceStore {
  presignUpload(input: PresignUploadInput): Promise<{ readonly assetId: string; readonly uploadUrl: string; readonly expiresAt: Date }>;
  presignDownload(organizationId: string, assetId: string): Promise<{ readonly url: string; readonly expiresAt: Date }>;
  scheduleDeletion(organizationId: string, assetId: string, deleteAfter: Date): Promise<void>;
}

/** Throws. Task: T-EXP-004. */
export function createEvidenceStore(): EvidenceStore {
  throw new Error("Not implemented: T-EXP-004");
}
