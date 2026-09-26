/**
 * Readiness endpoint (`GET /readyz`).
 *
 * Requirements: NFR-OBS-004, OBSERVABILITY.md §6, DEPLOYMENT.md §4.
 * Task: T-OBS-004.
 *
 * Contract: 200 { ok: true } only if PG `SELECT 1` OK AND storage canary
 * HEAD OK; else 503 { ok: false, missing: ["db"|"storage"] }.
 * No detail beyond `missing` (no versions, no error text — THREAT T-13).
 * Unauthenticated; no cache; < 10 ms typical.
 */
export async function GET(): Promise<Response> {
  // TODO(T-OBS-004): implement (PG ping + storage canary).
  throw new Error('Not implemented: T-OBS-004');
}
