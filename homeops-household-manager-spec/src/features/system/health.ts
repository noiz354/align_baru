// HomeOps — health read model (T-PLAT-024, OBSERVABILITY.md §5).
//
// Lives in a feature because `app/**` may not import `server/**` (MODULE-MAP.md §1); the probe
// adapters themselves live in `src/server/health/probe.ts`. Documented in MODULE-MAP.md §5.

import { createClock, type Clock } from '../../shared/time/clock';
import {
  applicationVersion,
  probeDatabase,
  probeMigrations,
  probeOutbox,
  probeScheduler,
  type ProbeCode,
} from '../../server/health/probe';

export type HealthStatus = 'ok' | 'degraded' | 'unhealthy';

export type LivenessReport = {
  readonly status: HealthStatus;
  readonly version: string;
  readonly schemaVersion: string;
};

export type ReadinessReport = {
  readonly status: HealthStatus;
  readonly codes: {
    readonly database: ProbeCode;
    readonly migrations: ProbeCode;
    readonly scheduler: ProbeCode;
    readonly outbox: ProbeCode;
  };
  readonly checkedAt: string;
};

/** Liveness: "is the process able to answer?" — never touches the database. */
export function liveness(): LivenessReport {
  const { version, schemaVersion } = applicationVersion();
  return { status: 'ok', version, schemaVersion };
}

/**
 * Readiness: "can this instance serve a household right now?".
 * Broken core (database, migrations) → `unhealthy` (503). Everything else → `degraded` (200).
 */
export async function readiness(clock: Clock = createClock()): Promise<ReadinessReport> {
  // Probes run in parallel: the whole response must stay under 200 ms (OBSERVABILITY.md §5).
  const [database, migrations, scheduler, outbox] = await Promise.all([
    probeDatabase(),
    probeMigrations(),
    probeScheduler(),
    probeOutbox(),
  ]);

  const coreBroken =
    database.code === 'DOWN' || database.code === 'NOT_CONFIGURED' || migrations.code === 'MISMATCH';
  const degraded =
    scheduler.code === 'DEGRADED' ||
    scheduler.code === 'UNAVAILABLE' ||
    outbox.code === 'BACKLOG' ||
    outbox.code === 'DEGRADED' ||
    migrations.code === 'UNAVAILABLE';

  return {
    status: coreBroken ? 'unhealthy' : degraded ? 'degraded' : 'ok',
    codes: {
      database: database.code,
      migrations: migrations.code,
      scheduler: scheduler.code,
      outbox: outbox.code,
    },
    checkedAt: clock.now(),
  };
}

export function httpStatusFor(report: LivenessReport | ReadinessReport): number {
  return report.status === 'unhealthy' ? 503 : 200;
}
