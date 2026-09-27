// HomeOps — transaction boundary (T-PLAT-005, ARCHITECTURE.md §10, ADR-003, ADR-005).
//
// One transaction per use case; repository ports never open their own transactions. Every repository
// handle handed to a domain service is scoped to the context's household, and events/outbox rows are
// written inside the same transaction as the state change that caused them (I-XA-007).

import type { Clock } from '../../shared/time/clock';
import { createClock } from '../../shared/time/clock';
import { createIdGenerator, type IdGenerator } from './id';
import { isRetriableSerializationFailure } from './errors';
import { createRepositories, type Repositories } from './repositories';
import { createSystemRepositories, type SystemRepositories } from './system';
import { getDb, type Db } from './client';
import type { HouseholdContext } from '../auth/context';

/** A transaction handle is structurally a database handle for our purposes (same query builder). */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export type { Repositories };

export type UnitOfWorkDeps = {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
};

const MAX_ATTEMPTS = 3;

/**
 * Run a use case in one transaction with household-scoped repositories.
 *
 * The context's `householdId` is the *only* scope the repositories see: a service that receives a
 * different household id (a forged or stale one) gets `null`/`NOT_FOUND` back, never another
 * household's rows (ADR-005, I-XA-001, T-SEC-002).
 */
export async function withUnitOfWork<T>(
  ctx: HouseholdContext,
  fn: (repos: Repositories) => Promise<T>,
  deps: UnitOfWorkDeps = {},
): Promise<T> {
  return runWithRetry(async () => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const repos = createRepositories({
        db: tx,
        householdId: ctx.householdId,
        clock: deps.clock ?? createClock(),
        ids: deps.ids ?? createIdGenerator(),
      });
      return fn(repos);
    });
  });
}

/**
 * Scheduler path (ADR-013): job code has no session, so it uses system repositories to enumerate
 * households and then calls `withUnitOfWork` with a context it constructed per household (T-HH-003).
 */
export async function withSystemUnitOfWork<T>(
  fn: (repos: SystemRepositories) => Promise<T>,
  deps: UnitOfWorkDeps = {},
): Promise<T> {
  return runWithRetry(async () => {
    const db = getDb();
    return db.transaction(async (tx) => {
      const repos = createSystemRepositories({
        db: tx,
        clock: deps.clock ?? createClock(),
        ids: deps.ids ?? createIdGenerator(),
      });
      return fn(repos);
    });
  });
}

/** Escape hatch for adapters that must run a single statement outside a use case (health checks). */
export async function withTransaction<T>(fn: (tx: DbOrTx) => Promise<T>): Promise<T> {
  return runWithRetry(async () => {
    const db = getDb();
    return db.transaction(async (tx) => fn(tx));
  });
}

async function runWithRetry<T>(attempt: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      // The unit of work is the only place a serialization failure is retried (ARCHITECTURE.md §10).
      if (!isRetriableSerializationFailure(error) || tries === MAX_ATTEMPTS - 1) throw error;
      lastError = error;
      await sleep(20 * 2 ** tries);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
