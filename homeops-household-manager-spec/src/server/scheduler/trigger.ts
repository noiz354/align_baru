// HomeOps — manual trigger for one scheduler job (T-PLAT-014, ADR-013, RUNBOOK.md).
//
// Session-less surface: authenticated with a shared secret compared in constant time, allow-listed
// by job name, and rate limited per job. Lives in `server` (not in a feature) because it needs the
// rate-limit store and the database, and `features/**` may not import `src/server/db`
// (MODULE-MAP.md §1). The feature in `src/features/system/cron.ts` is the thin caller.

import { timingSafeEqual } from 'node:crypto';
import { JOB_NAMES, runTick, type JobName, type TickSummary } from './tick';
import { withSystemUnitOfWork } from '../db/unit-of-work';
import { isDatabaseConfigured } from '../db/client';
import { hashIp } from '../telemetry/request-id';
import { logger } from '../telemetry/logger';

export type TriggerCode =
  'UNKNOWN_JOB' | 'MISSING_SECRET' | 'FORBIDDEN' | 'RATE_LIMITED' | 'DATABASE_UNAVAILABLE' | 'LOCK_HELD';

export type TriggerResult =
  | {
      readonly ok: true;
      readonly job: JobName;
      readonly ran: number;
      readonly failed: number;
      readonly skipped: number;
      readonly durationMs: number;
    }
  | { readonly ok: false; readonly code: TriggerCode; readonly retryAfterSeconds?: number };

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

/** Constant-time comparison: a byte-by-byte loop would leak the shared prefix length (SECURITY.md §6). */
export function secretMatches(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function triggerJob(input: {
  readonly job: string;
  readonly secret: string | null;
  readonly ip: string | null;
}): Promise<TriggerResult> {
  if (!isJobName(input.job)) return { ok: false, code: 'UNKNOWN_JOB' };
  if (!secretMatches(input.secret, process.env.CRON_SECRET)) {
    // No detail about *why* it failed: an unauthenticated caller learns nothing (SECURITY.md §6).
    logger.warn('cron trigger rejected', { operation: 'cron.trigger', outcome: 'denied', code: 'FORBIDDEN' });
    return { ok: false, code: 'FORBIDDEN' };
  }
  if (!isDatabaseConfigured()) return { ok: false, code: 'DATABASE_UNAVAILABLE' };

  // 6 triggers per hour per job (SECURITY.md §8, T-PLAT-014), keyed by job + hashed caller ip.
  const limit = await withSystemUnitOfWork((repos) =>
    repos.rateLimits.consume({
      cls: 'CRON_TRIGGER_PER_JOB',
      scope: `${input.job}:${hashIp(input.ip) ?? 'local'}`,
      now: new Date(),
    }),
  );
  if (!limit.allowed) {
    return limit.retryAfterSeconds === undefined
      ? { ok: false, code: 'RATE_LIMITED' }
      : { ok: false, code: 'RATE_LIMITED', retryAfterSeconds: limit.retryAfterSeconds };
  }

  const summary: TickSummary = await runTick(input.job);
  const lockHeld = summary.outcomes.some((outcome) => outcome.status === 'SKIPPED_LOCK_HELD');
  if (summary.ran === 0 && lockHeld) return { ok: false, code: 'LOCK_HELD' };

  logger.info('cron trigger ran', {
    job: input.job,
    outcome: summary.failed > 0 ? 'failed' : 'ok',
    count: summary.ran,
    durationMs: summary.durationMs,
  });
  return {
    ok: true,
    job: input.job,
    ran: summary.ran,
    failed: summary.failed,
    skipped: summary.skipped,
    durationMs: summary.durationMs,
  };
}
