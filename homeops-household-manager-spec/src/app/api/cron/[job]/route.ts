// HomeOps - route skeleton (specification phase). Handler shells only.

/**
 * POST /api/cron/:job - manual trigger for one scheduler job (SESSION-less; shared-secret auth).
 *
 * Rules: the secret is compared in constant time; only allow-listed job names are accepted
 * (JOB_NAMES in src/server/scheduler/tick.ts); rate limited 30/min; jobs construct their own
 * household contexts internally and never trust the caller for tenancy (ADR-013).
 * The in-process loop is the primary scheduler - this route exists for manual runs and as an
 * external-cron fallback (ARCHITECTURE.md section 9).
 *
 * Owning task: T-PLAT-014.
 */
export async function POST(_request: Request, _context: { readonly params: Promise<{ readonly job: string }> }): Promise<Response> {
  throw new Error('Not implemented: T-PLAT-014');
}
