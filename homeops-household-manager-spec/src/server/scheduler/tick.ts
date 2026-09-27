// HomeOps — the scheduler tick (T-PLAT-010, T-PLAT-011, ADR-013, OBSERVABILITY.md §5/§7).
//
// Single-flight across processes, idempotent per job, observable per run:
//  - jobs run under `pg_try_advisory_lock`, so two instances cannot double-run;
//  - a late or missed tick converges, because jobs derive their work from state, not elapsed time;
//  - partial failure is isolated per job (and per household inside a job): one failure cannot stop
//    the others;
//  - every job records a run row so `/api/health?deep=1` can report staleness honestly.

import { JOB_REGISTRY, findJob, type JobOutcome } from './registry';
import { errorClassOf, tryAdvisoryLock } from './locks';
import { withSystemUnitOfWork } from '../db/unit-of-work';
import { logger } from '../telemetry/logger';
import { recordMetric } from '../telemetry/metrics';

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

/** Tick cadence from ADR-013: one minute. Jobs must be cheap enough to finish inside it. */
export const TICK_INTERVAL_SECONDS = 60;

/** A 60 s job that has not succeeded for this long makes readiness "degraded" (OBSERVABILITY.md §7). */
export const STALE_AFTER_MS = 15 * 60 * 1000;

export type TickSummary = {
  readonly ran: number;
  readonly failed: number;
  readonly skipped: number;
  readonly outcomes: readonly JobOutcome[];
  readonly durationMs: number;
};

export async function runTick(job: JobName | 'all'): Promise<TickSummary> {
  const started = Date.now();
  const nowInstant = new Date(started).toISOString();
  const jobs = job === 'all' ? JOB_REGISTRY : JOB_REGISTRY.filter((entry) => entry.name === job);
  const outcomes: JobOutcome[] = [];

  for (const definition of jobs) {
    outcomes.push(await runOneJob(definition.name, nowInstant));
  }

  const summary: TickSummary = {
    ran: outcomes.filter((outcome) => outcome.status === 'RAN').length,
    failed: outcomes.filter((outcome) => outcome.status === 'FAILED' || outcome.status === 'TIMEOUT').length,
    skipped: outcomes.filter((outcome) => outcome.status.startsWith('SKIPPED')).length,
    outcomes,
    durationMs: Date.now() - started,
  };

  logger.info('scheduler tick', {
    job: job === 'all' ? 'all' : job,
    outcome: summary.failed > 0 ? 'failed' : 'ok',
    count: summary.ran,
    durationMs: summary.durationMs,
  });
  return summary;
}

async function runOneJob(name: JobName, nowInstant: string): Promise<JobOutcome> {
  const definition = findJob(name);
  if (!definition) {
    return { job: name, status: 'SKIPPED_NOT_IMPLEMENTED', processed: 0, durationMs: 0 };
  }

  // A job whose slice has not landed is skipped and *reported* as skipped: pretending it ran would
  // hide the gap (AGENTS.md §8, DESIGN.md §11).
  if (definition.pendingTask) {
    logger.debug('job pending its slice', { job: name, code: definition.pendingTask, outcome: 'ok' });
    return { job: name, status: 'SKIPPED_NOT_IMPLEMENTED', processed: 0, durationMs: 0 };
  }

  const lock = await tryAdvisoryLock({ key: definition.lockKey });
  if (!lock.acquired) {
    // Overlapping ticks exit immediately rather than queue (ARCHITECTURE.md §11).
    logger.info('job lock held elsewhere', { job: name, outcome: 'ok' });
    return { job: name, status: 'SKIPPED_LOCK_HELD', processed: 0, durationMs: 0 };
  }

  const startedAt = Date.now();
  try {
    await withSystemUnitOfWork(async (repos) => repos.schedulerRuns.recordStarted(name, new Date(startedAt)));
    const result = await withTimeout(definition.run({ nowInstant }), definition.timeoutMs, name);
    const durationMs = Date.now() - startedAt;
    await withSystemUnitOfWork(async (repos) =>
      repos.schedulerRuns.recordSucceeded(name, { now: new Date(), durationMs, processed: result.processed }),
    );
    recordMetric('scheduler_job_duration_ms', durationMs, { job: name, outcome: 'ok' });
    logger.info('job finished', { job: name, outcome: 'ok', durationMs, count: result.processed });
    return { job: name, status: 'RAN', processed: result.processed, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const timedOut = error instanceof JobTimeoutError;
    const errorClass = timedOut ? 'TIMEOUT' : errorClassOf(error);
    await withSystemUnitOfWork(async (repos) =>
      repos.schedulerRuns.recordFailed(name, { now: new Date(), durationMs, errorClass }),
    ).catch(() => {
      // If the database is down the tick cannot record its own failure; the log line is the record.
    });
    recordMetric('scheduler_job_duration_ms', durationMs, { job: name, outcome: 'failed' });
    recordMetric('scheduler_job_failures_total', 1, { job: name });
    logger.error('job failed', { job: name, outcome: 'failed', durationMs, errorClass });
    return { job: name, status: timedOut ? 'TIMEOUT' : 'FAILED', processed: 0, durationMs, errorClass };
  } finally {
    await lock.release();
  }
}

class JobTimeoutError extends Error {
  constructor(job: string, timeoutMs: number) {
    super(`job ${job} exceeded ${timeoutMs}ms`);
    this.name = 'JobTimeoutError';
  }
}

/**
 * Abandon waiting after the timeout (ADR-013). The database work is not cancellable from here; the
 * advisory lock is released when this function's caller finishes, and the next tick retries.
 */
async function withTimeout<T>(work: Promise<T>, timeoutMs: number, job: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new JobTimeoutError(job, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Readiness helper: how stale is each job's last success (OBSERVABILITY.md §5, T-PLAT-024). */
export async function jobStaleness(): Promise<
  readonly { job: string; ageMs: number | null; stale: boolean; consecutiveFailures: number }[]
> {
  return withSystemUnitOfWork(async (repos) => {
    const runs = await repos.schedulerRuns.all();
    const now = Date.now();
    return JOB_NAMES.map((name) => {
      const run = runs.find((entry) => entry.job === name);
      const ageMs = run?.lastSucceededAt ? now - Date.parse(run.lastSucceededAt) : null;
      return {
        job: name,
        ageMs,
        // A job that has never succeeded is stale only if it is implemented; pending jobs report null.
        stale: ageMs !== null && ageMs > STALE_AFTER_MS,
        consecutiveFailures: run?.consecutiveFailures ?? 0,
      };
    });
  });
}
