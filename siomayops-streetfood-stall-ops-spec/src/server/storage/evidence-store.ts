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

import { generateId } from "../db/memory-store";

class InMemoryEvidenceStore implements EvidenceStore {
  private assets = new Map<string, { organizationId: string; contentType: string; createdAt: Date }>();

  async presignUpload(input: PresignUploadInput): Promise<{ readonly assetId: string; readonly uploadUrl: string; readonly expiresAt: Date }> {
    const assetId = generateId();
    this.assets.set(assetId, {
      organizationId: input.organizationId,
      contentType: input.contentType,
      createdAt: new Date(),
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    // In real implementation, this would be a presigned S3 URL
    const uploadUrl = `/api/v1/evidence/${assetId}/upload?token=fake-presigned`;
    return { assetId, uploadUrl, expiresAt };
  }

  async presignDownload(organizationId: string, assetId: string): Promise<{ readonly url: string; readonly expiresAt: Date }> {
    const asset = this.assets.get(assetId);
    if (!asset || asset.organizationId !== organizationId) {
      throw Object.assign(new Error("Asset not found"), { code: "NOT_FOUND" });
    }
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const url = `/api/v1/evidence/${assetId}/download?token=fake-presigned`;
    return { url, expiresAt };
  }

  async scheduleDeletion(organizationId: string, assetId: string, _deleteAfter: Date): Promise<void> {
    // In real implementation, schedule deletion job
    this.assets.delete(assetId);
  }
}

let storeInstance: EvidenceStore | null = null;

export function createEvidenceStore(): EvidenceStore {
  if (!storeInstance) storeInstance = new InMemoryEvidenceStore();
  return storeInstance;
}
