// HomeOps — health endpoints (T-PLAT-024, OBSERVABILITY.md §5).
//
// GET /api/health          liveness: { status, version, schemaVersion }
// GET /api/health?deep=1   readiness: database, migration match, per-job tick age, outbox backlog
//
// Unauthenticated but information-minimal: codes only, `no-store`, and under 200 ms.

import { NextResponse } from 'next/server';
import { httpStatusFor, liveness, readiness } from '../../../features/system/health';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const deep = new URL(request.url).searchParams.get('deep');
  const headers = { 'Cache-Control': 'no-store, max-age=0' };

  if (deep !== '1' && deep !== 'true') {
    return NextResponse.json(liveness(), { status: 200, headers });
  }

  const report = await readiness();
  return NextResponse.json(report, { status: httpStatusFor(report), headers });
}
