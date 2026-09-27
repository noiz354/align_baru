// HomeOps — manual scheduler trigger (T-PLAT-014, RUNBOOK.md).
//
// POST /api/cron/:job — session-less, shared-secret authenticated, rate limited, allow-listed.
// The in-process loop is the primary scheduler; this route exists for manual runs and as an
// external-cron fallback (ARCHITECTURE.md §9).

import { NextResponse } from 'next/server';
import { isJobName, runCronJob, statusForTrigger } from '../../../../features/system/cron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly job: string }> },
): Promise<Response> {
  const { job } = await context.params;
  const headers: Record<string, string> = { 'Cache-Control': 'no-store, max-age=0' };

  if (!isJobName(job)) {
    // An unknown job name is a 404 with no hint about which jobs exist (SECURITY.md §6).
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Unknown job' } },
      { status: 404, headers },
    );
  }

  const result = await runCronJob({
    job,
    secret: request.headers.get('x-cron-secret'),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  });

  if (!result.ok) {
    const status = statusForTrigger(result.code);
    const body: Record<string, unknown> = {
      error: { code: result.code === 'UNKNOWN_JOB' ? 'NOT_FOUND' : result.code, message: 'Job not run' },
    };
    if (
      result.code === 'RATE_LIMITED' &&
      'retryAfterSeconds' in result &&
      result.retryAfterSeconds !== undefined
    ) {
      headers['Retry-After'] = String(result.retryAfterSeconds);
    }
    return NextResponse.json(body, { status, headers });
  }

  // Counts only: no household ids, no entity data, no timings per household (OBSERVABILITY.md §5).
  return NextResponse.json(
    {
      job: result.job,
      ran: result.ran,
      failed: result.failed,
      skipped: result.skipped,
      durationMs: result.durationMs,
    },
    { status: 200, headers },
  );
}
