/**
 * POST /api/auth/logout — API route shell.
 *
 * Requirement: FR-AUTH-003. Task: T-AUTH-004.
 * Idempotent: logged-out state ⇒ 200 (no error for already-signed-out).
 * Cookie cleared with matching attributes (E2E-AUTH-004).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-AUTH-004');
}
