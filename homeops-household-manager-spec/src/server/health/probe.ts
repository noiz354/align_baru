// HomeOps — readiness probes (T-PLAT-024, T-OBS-007, OBSERVABILITY.md §5).
//
// Codes only: the probe answers "is this dependency healthy?" and never returns row counts, table
// names, SQL text, or household data. A degraded dependency returns a code that maps to HTTP 200
// with `status: "degraded"`; a broken core maps to 503, so an uptime monitor can tell "wake me up"
// from "note it".

import { readFileSync } from 'node:fs';
import { getSql, isDatabaseConfigured, pingDatabase } from '../db/client';
import { withSystemUnitOfWork } from '../db/unit-of-work';
import { JOB_NAMES, STALE_AFTER_MS } from '../scheduler/tick';
import { errorClassOf } from '../scheduler/locks';
import { logger } from '../telemetry/logger';

export type ProbeCode =
  'OK' | 'DOWN' | 'MISMATCH' | 'DEGRADED' | 'BACKLOG' | 'NOT_CONFIGURED' | 'UNAVAILABLE';

export type ProbeResult = { readonly code: ProbeCode; readonly detailMs?: number };

export async function probeDatabase(): Promise<ProbeResult> {
  if (!isDatabaseConfigured()) return { code: 'NOT_CONFIGURED' };
  const started = Date.now();
  try {
    await pingDatabase();
    return { code: 'OK', detailMs: Date.now() - started };
  } catch (error) {
    logger.warn('database probe failed', {
      operation: 'health.database',
      outcome: 'failed',
      errorClass: errorClassOf(error),
    });
    return { code: 'DOWN', detailMs: Date.now() - started };
  }
}

/**
 * Compare the committed migration journal with what the database has applied. A mismatch means a
 * deploy switched code before migrations ran (DEPLOYMENT.md §rollout) — that is a 503, not a warning.
 */
export async function probeMigrations(): Promise<ProbeResult> {
  if (!isDatabaseConfigured()) return { code: 'NOT_CONFIGURED' };
  try {
    const journalPath = new URL('../../../migrations/meta/_journal.json', import.meta.url);
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries?: unknown[] };
    const expected = journal.entries?.length ?? 0;
    const rows = await getSql()`
      select count(*)::int as applied
      from drizzle.__drizzle_migrations
    `;
    const applied = Number(rows[0]?.applied ?? 0);
    return applied === expected ? { code: 'OK' } : { code: 'MISMATCH' };
  } catch (error) {
    logger.warn('migration probe failed', {
      operation: 'health.migrations',
      outcome: 'failed',
      errorClass: errorClassOf(error),
    });
    return { code: 'UNAVAILABLE' };
  }
}

/** Staleness per job, reduced to one code: DEGRADED when an *implemented* job is stale. */
export async function probeScheduler(): Promise<ProbeResult> {
  if (!isDatabaseConfigured()) return { code: 'NOT_CONFIGURED' };
  try {
    return await withSystemUnitOfWork(async (repos) => {
      const runs = await repos.schedulerRuns.all();
      const now = Date.now();
      const staleImplemented = runs.filter((run) => {
        if (!JOB_NAMES.includes(run.job as (typeof JOB_NAMES)[number])) return false;
        if (!run.lastSucceededAt) return false;
        return now - Date.parse(run.lastSucceededAt) > STALE_AFTER_MS;
      });
      return staleImplemented.length > 0 ? { code: 'DEGRADED' as const } : { code: 'OK' as const };
    });
  } catch (error) {
    logger.warn('scheduler probe failed', {
      operation: 'health.scheduler',
      outcome: 'failed',
      errorClass: errorClassOf(error),
    });
    return { code: 'UNAVAILABLE' };
  }
}

/** Outbox backlog: coarse buckets only (OBSERVABILITY.md §5 — "no counts beyond coarse categories"). */
export async function probeOutbox(): Promise<ProbeResult> {
  if (!isDatabaseConfigured()) return { code: 'NOT_CONFIGURED' };
  try {
    return await withSystemUnitOfWork(async (repos) => {
      const counts = await repos.outbox.counts();
      if (counts.dead > 0) return { code: 'DEGRADED' as const };
      // 500 pending messages is far above a household's daily volume (DATA_MODEL.md §2.9).
      return counts.pending > 500 ? { code: 'BACKLOG' as const } : { code: 'OK' as const };
    });
  } catch (error) {
    logger.warn('outbox probe failed', {
      operation: 'health.outbox',
      outcome: 'failed',
      errorClass: errorClassOf(error),
    });
    return { code: 'UNAVAILABLE' };
  }
}

/** Application version + schema version for the liveness body (no internals beyond that). */
export function applicationVersion(): { readonly version: string; readonly schemaVersion: string } {
  return {
    version: process.env.npm_package_version ?? process.env.APP_VERSION ?? 'dev',
    schemaVersion: process.env.SCHEMA_VERSION ?? '0000',
  };
}
