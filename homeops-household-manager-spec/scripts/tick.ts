#!/usr/bin/env tsx
// HomeOps — manual scheduler tick (T-PLAT-010, T-PLAT-011, ADR-013, RUNBOOK.md#scheduler).
//
// Runs one tick outside the request path so an operator (or a restore drill, BACKUP-RESTORE.md §4.1
// step 5) can prove the jobs work. Exit code is non-zero when any job failed or timed out: a tick
// that skipped unimplemented jobs is *not* a failure, and says so.

import { JOB_NAMES, jobStaleness, runTick, type JobName } from '../src/server/scheduler/tick';
import { closeDb, isDatabaseConfigured } from '../src/server/db/client';

function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

async function main(): Promise<number> {
  const requested = process.argv[2] ?? 'all';
  if (requested !== 'all' && !isJobName(requested)) {
    console.error(`tick: unknown job "${requested}" — one of: all, ${JOB_NAMES.join(', ')}`);
    return 2;
  }
  if (!isDatabaseConfigured()) {
    console.error('tick: refused — DATABASE_URL is not set (the scheduler needs the advisory lock table)');
    return 2;
  }

  try {
    const summary = await runTick(requested);
    for (const outcome of summary.outcomes) {
      const detail = outcome.errorClass ? ` errorClass=${outcome.errorClass}` : '';
      console.log(
        `tick: ${outcome.job} → ${outcome.status} processed=${outcome.processed} ` +
          `durationMs=${outcome.durationMs}${detail}`,
      );
    }
    console.log(
      `tick: ran=${summary.ran} failed=${summary.failed} skipped=${summary.skipped} durationMs=${summary.durationMs}`,
    );
    for (const entry of await jobStaleness()) {
      console.log(
        `tick: staleness ${entry.job} ageMs=${entry.ageMs ?? 'never'} stale=${entry.stale} ` +
          `consecutiveFailures=${entry.consecutiveFailures}`,
      );
    }
    return summary.failed > 0 ? 1 : 0;
  } catch (error) {
    console.error(`tick: failed — ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await closeDb();
  }
}

process.exitCode = await main();
