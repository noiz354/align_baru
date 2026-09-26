/**
 * POST /api/reader/beacon — API route shell.
 *
 * Requirement: NFR-OBS-007. Task: T-OBS-007.
 * Auth: optional (anonymous allowed; the payload carries a sessionId,
 * never account PII — NFR-OBS-006). Rate-limited (NFR-SEC-006).
 * 202 accepted; NEVER fails the caller (fire-and-forget from the client).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-OBS-007');
}
