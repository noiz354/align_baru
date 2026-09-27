// HomeOps — job registry (T-PLAT-011, ADR-013).
//
// Every job declares its owning task and whether it is ready to run. A job whose slice has not been
// implemented is *skipped and recorded as skipped* — never faked as successful, because a green tick
// that did no work is exactly the invisible failure DESIGN.md §11 forbids.

import type { JobName } from './tick';

export type JobOutcome = {
  readonly job: JobName;
  readonly status:
    'RAN' | 'SKIPPED_LOCK_HELD' | 'SKIPPED_NOT_IMPLEMENTED' | 'SKIPPED_DISABLED' | 'FAILED' | 'TIMEOUT';
  readonly processed: number;
  readonly durationMs: number;
  readonly errorClass?: string;
};

export type JobDefinition = {
  readonly name: JobName;
  /** Task that owns the implementation; `null` once the job is real. */
  readonly pendingTask: string | null;
  readonly timeoutMs: number;
  /** Advisory-lock key: per job, so one slow job cannot block the others (ADR-013). */
  readonly lockKey: string;
  readonly run: (input: { readonly nowInstant: string }) => Promise<{ readonly processed: number }>;
};

const notImplemented = (task: string) => async (): Promise<{ processed: number }> => {
  throw new Error(`Not implemented: ${task}`);
};

/**
 * Registry order matters: work that creates facts runs before work that reacts to them
 * (materialise → evaluate → notify → prune). ROADMAP.md §4 fixes the same ordering between slices.
 */
export const JOB_REGISTRY: readonly JobDefinition[] = [
  {
    name: 'materialise-chores',
    pendingTask: 'T-CHORE-010',
    timeoutMs: 60_000,
    lockKey: 'job:materialise-chores',
    run: notImplemented('T-CHORE-010'),
  },
  {
    name: 'evaluate-alerts',
    pendingTask: 'T-ALERT-027',
    timeoutMs: 60_000,
    lockKey: 'job:evaluate-alerts',
    run: notImplemented('T-ALERT-027'),
  },
  {
    name: 'sweep-expired',
    pendingTask: 'T-ROOM-004',
    timeoutMs: 30_000,
    lockKey: 'job:sweep-expired',
    run: notImplemented('T-ROOM-004'),
  },
  {
    name: 'escalate-alerts',
    pendingTask: 'T-ALERT-011',
    timeoutMs: 30_000,
    lockKey: 'job:escalate-alerts',
    run: notImplemented('T-ALERT-011'),
  },
  {
    name: 'recompute-maintenance',
    pendingTask: 'T-MNT-008',
    timeoutMs: 30_000,
    lockKey: 'job:recompute-maintenance',
    run: notImplemented('T-MNT-008'),
  },
  {
    name: 'drain-notifications',
    pendingTask: 'T-NOTIF-008',
    timeoutMs: 60_000,
    lockKey: 'job:drain-notifications',
    run: notImplemented('T-NOTIF-008'),
  },
  {
    name: 'prune-activity',
    pendingTask: null, // implemented: T-PLAT-013
    timeoutMs: 120_000,
    lockKey: 'job:prune-activity',
    run: async ({ nowInstant }) => {
      const { runRetentionPrune } = await import('./jobs/prune-activity');
      return runRetentionPrune({ nowInstant });
    },
  },
  {
    name: 'prune-attachments',
    pendingTask: 'T-ISSUE-006',
    timeoutMs: 60_000,
    lockKey: 'job:prune-attachments',
    run: notImplemented('T-ISSUE-006'),
  },
];

export function findJob(name: JobName): JobDefinition | undefined {
  return JOB_REGISTRY.find((job) => job.name === name);
}
