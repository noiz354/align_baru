/**
 * Upload boundary types only; no file intake, decoding, archive extraction or storage.
 * Requirements: FR-UPLOAD-001..004, NFR-SEC-011. ADR-004/005.
 * Tasks: T-UPLOAD-014, T-UPLOAD-015. See SECURITY.md and THREAT_MODEL.md.
 */
export interface ChapterUploadInput { actorId: string; chapterId: string; originalName: string; declaredBytes: number; declaredMediaType: string; idempotencyKey: string; }
export interface PreparedChapterUpload { uploadId: string; status: "quarantined" | "rejected"; rejectionCode?: string; }
/** TODO(T-UPLOAD-014): validate untrusted metadata and quarantine policy; never publish on intake. */
export async function prepareChapterUpload(_input: ChapterUploadInput): Promise<PreparedChapterUpload> {
  throw new Error("Not implemented: T-UPLOAD-014");
}
