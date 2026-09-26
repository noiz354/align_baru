/**
 * Liveness endpoint (`GET /healthz`).
 *
 * Requirements: NFR-OBS-004 (liveness — process serving, NO dependency
 * checks), DEPLOYMENT.md §4/§7.
 * Task: T-FOUND-007.
 *
 * Contract: 200 { ok: true }; unauthenticated; no cache; constant < 10 ms;
 * must stay 200 when the DB is down (that is what readiness is for).
 * No information disclosure (no version strings — the deploy smoke uses
 * a separate version probe, T-PROD-006).
 */
export async function GET(): Promise<Response> {
  // TODO(T-FOUND-007): implement (trivial — but still a task).
  throw new Error('Not implemented: T-FOUND-007');
}
