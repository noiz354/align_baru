// HomeOps - route skeleton (specification phase). Handler shells only.

/**
 * GET /api/health            liveness: { status, version, schemaVersion }
 * GET /api/health?deep=1     readiness: database, migration match, per-job tick age, outbox backlog
 *
 * Rules: no household data, no counts beyond coarse categories, no-store, under 200 ms, codes only.
 * A degraded dependency returns 200 with status "degraded"; a broken core returns 503 so an uptime
 * monitor can tell "wake me up" from "note it" (OBSERVABILITY.md section 5).
 *
 * Owning task: T-PLAT-024.
 */
export async function GET(_request: Request): Promise<Response> {
  throw new Error('Not implemented: T-PLAT-024');
}
