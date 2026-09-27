// HomeOps — cron trigger feature (T-PLAT-014).
//
// Thin caller: the route may not import `server/**` (MODULE-MAP.md §1), so this feature is the
// boundary that translates the trigger result into what the route returns. Counts only — no
// household ids, no entity data (OBSERVABILITY.md §5).

import { isJobName, triggerJob, type TriggerCode, type TriggerResult } from '../../server/scheduler/trigger';

export { isJobName };
export type CronTriggerResult = TriggerResult;

export async function runCronJob(input: {
  readonly job: string;
  readonly secret: string | null;
  readonly ip: string | null;
}): Promise<CronTriggerResult> {
  return triggerJob(input);
}

/** HTTP status for a trigger code (docs/api/ERROR-CATALOG.md status policy). */
export function statusForTrigger(code: TriggerCode): number {
  switch (code) {
    case 'FORBIDDEN':
    case 'MISSING_SECRET':
      return 403;
    case 'RATE_LIMITED':
      return 429;
    case 'LOCK_HELD':
      return 409;
    case 'DATABASE_UNAVAILABLE':
      return 503;
    case 'UNKNOWN_JOB':
      return 404;
    default:
      return 500;
  }
}
