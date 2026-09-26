/**
 * GET /api/uploads/{jobId}/status — API route shell.
 *
 * Requirement: FR-UPLOAD-007. Task: T-UPLOAD-009.
 * Auth: requireAdmin. 200 { job } (typed state; failed jobs carry
 * failureReason + causeCode — never raw error text, NFR-SEC-010).
 * Polling UX: 3 s cadence while queued/validating/processing.
 */
export async function GET(): Promise<Response> {
  throw new Error('Not implemented: T-UPLOAD-009');
}
