/**
 * POST /api/search — API route shell.
 *
 * Requirement: FR-SEARCH-001. Task: T-SEARCH-003.
 * Body → contract: API_CONTRACT §2.6 (q, limit, cursor) → hits + cursor.
 * Anonymous allowed; rate-limited (NFR-SEC-006); trigram-backed (ADR-009).
 */
export async function POST(): Promise<Response> {
  throw new Error('Not implemented: T-SEARCH-003');
}
