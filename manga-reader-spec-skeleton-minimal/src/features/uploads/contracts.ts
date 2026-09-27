/**
 * Upload boundary implementation adhering to quarantine security policy.
 * Requirements: FR-UPLOAD-001..004, NFR-SEC-011. ADR-004/005.
 * Tasks: T-UPLOAD-014, T-UPLOAD-015. See SECURITY.md and THREAT_MODEL.md.
 */
export interface ChapterUploadInput {
  actorId: string;
  chapterId: string;
  originalName: string;
  declaredBytes: number;
  declaredMediaType: string;
  idempotencyKey: string;
}

export interface PreparedChapterUpload {
  uploadId: string;
  status: "quarantined" | "rejected";
  rejectionCode?: string;
}

const ALLOWED_MEDIA_TYPES = new Set([
  "application/zip",
  "application/x-cbz",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_DECLARED_BYTES = 250 * 1024 * 1024; // 250MB limit

/**
 * Validates untrusted metadata and places upload into quarantined status (T-UPLOAD-014).
 * Never directly publishes intake files.
 */
export async function prepareChapterUpload(input: ChapterUploadInput): Promise<PreparedChapterUpload> {
  if (!input.actorId || !input.chapterId || !input.idempotencyKey) {
    return {
      uploadId: `up-rej-${Date.now()}`,
      status: "rejected",
      rejectionCode: "INVALID_METADATA",
    };
  }

  if (input.declaredBytes > MAX_DECLARED_BYTES || input.declaredBytes <= 0) {
    return {
      uploadId: `up-rej-${Date.now()}`,
      status: "rejected",
      rejectionCode: "BYTE_LIMIT_EXCEEDED",
    };
  }

  if (!ALLOWED_MEDIA_TYPES.has(input.declaredMediaType.toLowerCase())) {
    return {
      uploadId: `up-rej-${Date.now()}`,
      status: "rejected",
      rejectionCode: "UNSUPPORTED_MEDIA_TYPE",
    };
  }

  // Quarantined upload receipt for processing pipeline
  return {
    uploadId: `up-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    status: "quarantined",
  };
}
