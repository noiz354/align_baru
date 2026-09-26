/**
 * POST /api/uploads/prepare — API route shell.
 *
 * Requirement: FR-UPLOAD-002. Task: T-UPLOAD-008.
 * Auth: requireAdmin (FR-AUTH-008) → 401/403. Body → contract:
 * API_CONTRACT §2.5 (chapterId, pageCount, totalBytes) → 400 VALIDATION
 * (limits), 409 UPLOAD_NOT_ALLOWED (state), 201 { jobId, uploadUrl }.
 * The presigned PUT is the ONLY path from admin to storage.
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-UPLOAD-008');
}
