/**
 * One pool per process (F-001-S1).
 *
 * What this closes
 * ----------------
 * A single members' request could hold THREE pools: two composition roots each
 * called `createDb` independently, and `server/auth/guard.ts` opened and closed a
 * third per call. DEPLOYMENT.md §1 budgets the app 10 connections, so a third of
 * the budget was spent before any work happened. Nothing tested this, because
 * "the code calls a function" and "there is one pool" are different claims and
 * only the second one is a property.
 *
 * So this counts. Object identity IS the count: a pool is the driver client
 * object, so two acquisitions returning the same handle means one pool was
 * opened. A test that merely observed the calls would pass against a
 * non-memoised implementation, which is the mistake the `NEXT EXECUTABLE TASK`
 * in MASTER_PLAN.md warns about.
 *
 * Requirements: NFR-OPS-002, NFR-PERF-014
 * Tasks: T-FOUND-005, T-AUTH-007 (the third connection is fixed in F-001-S2)
 *
 * DSN: `DATABASE_URL`; SKIPS without it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { acquireDb, closeDb, createDb, releaseDb } from '../../src/server/db/client';
import { createCatalogComposition, createLibraryComposition } from '../../src/server/composition';
import { envSource } from './catalog.db-harness';
import type { Env, EnvSource } from '../../src/shared/validation';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

const env = (databaseUrl: string): Env => ({ databaseUrl }) as Env;

/**
 * The composition roots take an `EnvSource` (a raw record) rather than an `Env`,
 * because they run `loadEnv` themselves — that is the point of a composition
 * root. The full record comes from the shared harness beside `testEnv`; a partial
 * one is refused by `loadEnv`, correctly.
 */
const rawEnv = (databaseUrl: string): EnvSource => envSource(databaseUrl);

/**
 * Drains the shared pool without knowing its refcount, so one test cannot leave
 * a live pool for the next. Deliberately reaches the slot the same way the
 * production code does rather than importing a test-only reset: a reset helper
 * is a second implementation of the lifecycle, and it is the one that rots.
 */
async function drainSharedPool(): Promise<void> {
  const key = Symbol.for('yomi.db.pool');
  const g = globalThis as typeof globalThis & {
    [key]?: { promise: Promise<unknown> | null; refs: number };
  };
  const slot = g[key];
  if (slot?.promise) {
    const handle = (await slot.promise) as { close(): Promise<void> };
    slot.promise = null;
    slot.refs = 0;
    await handle.close();
  }
}

afterEach(async () => {
  await drainSharedPool();
});

/**
 * Counts real client backends on this database.
 *
 * `pg_stat_activity` is readable by any role for row COUNT purposes even when the
 * individual rows are redacted, so this needs no elevated privilege. Each pool
 * `createDb` builds costs exactly one backend, because `createDb` round-trips
 * `select 1` to prove the DSN works before returning.
 */
async function countBackends(): Promise<number> {
  const probe = await createDb(env(DATABASE_URL as string));
  try {
    const rows = await probe.execute(
      'select count(*)::int as n from pg_stat_activity ' +
        "where datname = current_database() and backend_type = 'client backend'",
    );
    return Number((rows as unknown as Array<{ n: number }>)[0]?.n ?? -1);
  } finally {
    await closeDb(probe);
  }
}

describeDb('the process-wide database handle (INT-DB-SINGLETON, F-001-S1)', () => {
  it('gives two acquisitions the same handle — one pool, not two', async () => {
    const first = await acquireDb(env(DATABASE_URL as string));
    const second = await acquireDb(env(DATABASE_URL as string));

    // Identity, not a call count. A pool IS this object.
    expect(second).toBe(first);
  });

  it('survives many acquisitions without opening another pool', async () => {
    const handles = await Promise.all(
      Array.from({ length: 8 }, () => acquireDb(env(DATABASE_URL as string))),
    );
    for (const handle of handles) expect(handle).toBe(handles[0]);
  });

  it('refuses to hand a live pool to a different DSN', async () => {
    await acquireDb(env(DATABASE_URL as string));
    // Silently reusing a pool built from another DSN would read from the wrong
    // database — a failure that produces plausible data, which is worse than a
    // crash.
    await expect(acquireDb(env('postgres://nobody@127.0.0.1:1/other'))).rejects.toThrow(
      /the environment DSN changed/i,
    );
  });

  it('drains only on the last release, so an early close cannot kill a live pool', async () => {
    // Two composition roots hold the same handle and each exposes a `close`. If
    // the first close drained the pool, the second root would keep a handle to a
    // dead pool — a use-after-free that only appears at shutdown.
    const a = await acquireDb(env(DATABASE_URL as string));
    const b = await acquireDb(env(DATABASE_URL as string));
    expect(b).toBe(a);

    await releaseDb(a);
    // Still usable: one holder remains.
    const stillAlive = await acquireDb(env(DATABASE_URL as string));
    expect(stillAlive).toBe(a);

    await releaseDb(stillAlive);
    await releaseDb(b);
    // Now the slot is empty, so the next acquire builds a NEW pool.
    const fresh = await acquireDb(env(DATABASE_URL as string));
    expect(fresh).not.toBe(a);
  });

  it('ignores a release beyond the count it took', async () => {
    const handle = await acquireDb(env(DATABASE_URL as string));
    await acquireDb(env(DATABASE_URL as string));
    await releaseDb(handle);
    await releaseDb(handle);
    await releaseDb(handle);
    // The count stopped at zero instead of going negative, so this is a fresh pool
    // rather than a resurrection of a closed one.
    const fresh = await acquireDb(env(DATABASE_URL as string));
    expect(fresh).not.toBe(handle);
  });

  it('does not memoise a failure, so a recovered database is reachable', async () => {
    // `createDb` is fail-fast. If the rejected promise were cached, a deployment
    // with a briefly unreachable database would replay the first failure forever.
    await expect(acquireDb(env('postgres://nobody@127.0.0.1:1/nope'))).rejects.toThrow();
    // No DSN was recorded for the failed attempt, so a good DSN is accepted
    // immediately rather than being rejected as "changed".
    const handle = await acquireDb(env(DATABASE_URL as string));
    expect(handle).toBeDefined();
  });

  it('leaves createDb alone: a test-owned handle is still its own pool', async () => {
    // The shared handle is for the composition roots, whose lifetime is the
    // process. `createDb` stays uncached so a suite can own and close its own.
    const owned = await createDb(env(DATABASE_URL as string));
    const shared = await acquireDb(env(DATABASE_URL as string));
    expect(owned).not.toBe(shared);
    await closeDb(owned);
  });

  it('opens ONE connection for both composition roots, not two', async () => {
    // The acceptance the whole slice exists for, measured the only way that can
    // actually fail: by counting real PostgreSQL backends.
    //
    // The previous version of this test compared `acquireDb` with itself and
    // passed even when both composition roots had been reverted to `createDb` —
    // a green test that proved nothing, because the compositions never exposed
    // their pool. Asserting object identity between handles is not enough either,
    // since identity is a claim about this module's own bookkeeping. Counting
    // backends is a claim about the database.
    const before = await countBackends();

    const library = await createLibraryComposition(rawEnv(DATABASE_URL as string));
    const catalog = await createCatalogComposition(rawEnv(DATABASE_URL as string));

    const after = await countBackends();
    // `createDb` round-trips `select 1`, so each pool that is created costs one
    // backend. Two roots sharing one pool cost one; two roots not sharing cost two.
    expect(after - before).toBe(1);

    // Both compositions are live, so the single pool is genuinely shared rather
    // than one root having released it.
    expect(library.library).toBeDefined();
    expect(catalog.catalog).toBeDefined();
  });
});
