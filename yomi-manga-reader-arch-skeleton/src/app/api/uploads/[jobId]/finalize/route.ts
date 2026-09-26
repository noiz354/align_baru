/**
 * POST /api/uploads/{jobId}/finalize — API route shell.
 *
 * Requirement: FR-UPLOAD-008. Task: T-UPLOAD-010.
 * Auth: requireAdmin. 200 { ok: true, chaptersAffected } | 409
 * UPLOAD_NOT_ALLOWED (state machine, EC-UP-04) | 422 UPLOAD_PARTIAL.
 * Finalize ⇒ atomic publish (pages become visible in one write).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-UPLOAD-010 (finalize route)');
}
