// HomeOps - server skeleton (specification phase). Scheduler contract only.

/**
 * The tick: single-flight across processes, idempotent per job, and observable
 * (ADR-013, OBSERVABILITY.md section 7).
 *
 * Contract:
 *  - jobs run under `pg_try_advisory_lock` per (job, household), so two instances cannot double-run;
 *  - a late or missed tick converges: jobs derive their work from state, not from elapsed time;
 *  - partial failure is isolated per household: one broken household cannot stop the others;
 *  - every job records a tick timestamp so /api/health?deep=1 can report staleness.
 *
 * Status: unimplemented by design. Owning tasks: T-PLAT-010, T-PLAT-011.
 */
export const JOB_NAMES = [
  'materialise-chores',
  'evaluate-alerts',
  'sweep-expired',
  'escalate-alerts',
  'recompute-maintenance',
  'drain-notifications',
  'prune-activity',
  'prune-attachments',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export async function runTick(_job: JobName | 'all'): Promise<{ readonly ran: number; readonly failed: number }> {
  throw new Error('Not implemented: T-PLAT-010');
}
