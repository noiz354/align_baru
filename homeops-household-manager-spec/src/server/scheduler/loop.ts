// HomeOps — the in-process tick loop (T-PLAT-010, ADR-013).
//
// One `setInterval` per process. Ticks never overlap: `runTick` takes an advisory lock per job and a
// tick that is still running when the next one is due is skipped rather than queued
// (ARCHITECTURE.md §11). Failures are recorded, never thrown into the timer callback.

import { TICK_INTERVAL_SECONDS, runTick } from './tick';
import { logger } from '../telemetry/logger';
import { isDatabaseConfigured } from '../db/client';

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startSchedulerLoop(intervalSeconds = TICK_INTERVAL_SECONDS): { readonly started: boolean } {
  if (timer) return { started: false };
  if (!isDatabaseConfigured()) {
    // Without a database the loop can only fail; say so once and stay quiet (DESIGN.md §11).
    logger.warn('scheduler loop not started: DATABASE_URL is not set', {
      job: 'loop',
      outcome: 'failed',
      code: 'DATABASE_NOT_CONFIGURED',
    });
    return { started: false };
  }

  timer = setInterval(() => {
    void tickOnce();
  }, intervalSeconds * 1000);
  // The loop must never keep the process alive on shutdown (ADR-015 graceful shutdown).
  timer.unref?.();
  logger.info('scheduler loop started', { job: 'loop', outcome: 'ok', count: intervalSeconds });
  return { started: true };
}

export function stopSchedulerLoop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info('scheduler loop stopped', { job: 'loop', outcome: 'ok' });
}

async function tickOnce(): Promise<void> {
  if (running) {
    // Overlapping ticks exit immediately (single-flight, ARCHITECTURE.md §11).
    logger.debug('tick skipped: previous tick still running', { job: 'loop', outcome: 'ok' });
    return;
  }
  running = true;
  try {
    await runTick('all');
  } catch (error) {
    // A thrown tick is recorded and the next tick retries; no partial state is committed because
    // each job is transactional (ARCHITECTURE.md §11).
    logger.error('scheduler tick threw', {
      job: 'loop',
      outcome: 'failed',
      errorClass: error instanceof Error ? error.constructor.name : 'UnknownError',
    });
  } finally {
    running = false;
  }
}

/** Test hook: is the loop armed? (tests/integration/scheduler/run-twice.test.ts) */
export function isLoopRunning(): boolean {
  return timer !== null;
}
