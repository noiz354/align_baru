/**
 * POST /api/auth/login — API route shell.
 *
 * Requirement: FR-AUTH-002. Task: T-AUTH-002.
 * Body → contract: API_CONTRACT §2.1 (uniform AUTH_INVALID, 401).
 * The service call is the ONLY way to this handler's outcome (D6);
 * session cookie set on success (flags per ADR-006, E2E-AUTH-004).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-AUTH-002');
}
