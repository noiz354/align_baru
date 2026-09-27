// HomeOps — system (session-less) repositories for jobs and probes (ADR-013, T-HH-003).
//
// Job code has no session, so it cannot mint a `HouseholdContext` from one. It enumerates active
// households here and then opens a normal household-scoped unit of work per household: the tenancy
// guarantee is preserved because the *scope* still comes from a database row, never from input.

import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Id } from '../../shared/types';
import type { Clock } from '../../shared/time/clock';
import type { HouseholdSettings } from '../../domain/household/types';
import type { IdempotencyStore } from '../../shared/contracts/idempotency';
import type { OutboxStore } from '../../shared/contracts/outbox';
import type { RateLimitStore } from '../../shared/contracts/rate-limit';
import { household, householdSettings } from './schema/tenancy';
import {
  createIdempotencyStore,
  createOutboxStore,
  createRateLimitStore,
  createSchedulerRunStore,
  type SchedulerRunStore,
} from './repositories/platform';
import { createSystemAuditRepository } from './repositories/activity';
import type { IdGenerator } from './id';
import type { DbOrTx } from './unit-of-work';

/** Everything a job needs to construct a per-household context (T-HH-003, ADR-013). */
export type HouseholdScope = {
  readonly householdId: Id;
  readonly timezone: string;
  readonly weekStartsOn: 'MONDAY' | 'SUNDAY';
  readonly settings: HouseholdSettings;
};

export type SystemRepositories = {
  /** Active (non-archived) households with their settings; archived households are skipped (T-HH-005). */
  listActiveHouseholds(): Promise<readonly HouseholdScope[]>;
  readonly schedulerRuns: SchedulerRunStore;
  readonly outbox: OutboxStore;
  readonly rateLimits: RateLimitStore;
  readonly idempotency: IdempotencyStore;
  readonly audit: ReturnType<typeof createSystemAuditRepository>;
  pruneExpiredKeys(now: Date): Promise<{ readonly rateLimits: number; readonly idempotency: number }>;
};

export type SystemRepositoryDeps = {
  readonly db: DbOrTx;
  readonly clock: Clock;
  readonly ids: IdGenerator;
};

export function createSystemRepositories(deps: SystemRepositoryDeps): SystemRepositories {
  const { db } = deps;
  const idempotency = createIdempotencyStore(db);
  const rateLimits = createRateLimitStore(db);

  return {
    async listActiveHouseholds() {
      const rows = await db
        .select({ household: household, settings: householdSettings })
        .from(household)
        .leftJoin(householdSettings, eq(householdSettings.householdId, household.id))
        .where(and(isNull(household.archivedAt)));
      return rows
        .filter((row) => row.settings !== null)
        .map((row) => ({
          householdId: row.household.id as Id,
          timezone: row.household.timezone,
          weekStartsOn: row.household.weekStartsOn,
          settings: {
            householdId: row.household.id as Id,
            maintenanceLeadDays: row.settings!.maintenanceLeadDays,
            snoozeMaxHours: row.settings!.snoozeMaxHours,
            infoExpiryDays: row.settings!.infoExpiryDays,
            ...(row.settings!.quietHoursStart && row.settings!.quietHoursEnd
              ? { quietHours: { start: row.settings!.quietHoursStart, end: row.settings!.quietHoursEnd } }
              : {}),
            dailyCapCeiling: row.settings!.dailyCapCeiling,
            roomOverrideMaxHours: row.settings!.roomOverrideMaxHours,
          },
        }));
    },
    schedulerRuns: createSchedulerRunStore(db),
    outbox: createOutboxStore(db),
    rateLimits,
    idempotency,
    audit: createSystemAuditRepository(db),
    async pruneExpiredKeys(now: Date) {
      return {
        rateLimits: await rateLimits.pruneExpired(now),
        idempotency: await idempotency.pruneExpired(now),
      };
    },
  };
}

/** Readiness probe helper: can the database answer a trivial query right now (T-PLAT-024). */
export async function checkDatabaseConnectivity(db: DbOrTx): Promise<{ readonly ok: boolean }> {
  await db.execute(sql`select 1`);
  return { ok: true };
}
