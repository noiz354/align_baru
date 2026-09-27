/**
 * INTEGRATION TEST - auth/rate-limit-durable.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-ORG-001 · Requirement(s): NFR-SEC-010, NFR-PRIV-006
 * Specification: SECURITY.md §13, ADR-0005 ("the default limiter is in-memory and resets on deploy"),
 *   API.md §Rate limits, docs/testing/STRATEGY.md
 *
 * Why these behaviours: a limiter that forgets on deploy, or that lets N concurrent requests all read
 * the same stale count, is not a control — it is decoration. Both failure modes are invisible in a
 * unit test with a fake store, so they are asserted here against real SQL.
 *
 * Concurrency note: PGlite executes statements one at a time, so the concurrency case below proves
 * the counter **arithmetic** under interleaving, not Postgres row locking. The locking guarantee comes
 * from the single-statement upsert (see the module doc comment) and must be re-run against
 * PostgreSQL 18 when T-TEST-001 wires the containerised suite.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import {
  consumeAuthLimit,
  createAuthRateLimitStorage,
  authRateLimitBucketKey,
  AUTH_POLICIES,
} from "@/server/auth/rate-limit-counters";
import {
  consumeCounter,
  deleteExpiredCounters,
} from "@/server/db/repositories/auth-rate-limit-counters";
import type { SqlExecutor } from "@/server/db/client";
import { createTestDatabase, type TestDatabaseHandle } from "../../support/database";

let handle: TestDatabaseHandle;
let database: TestDatabaseHandle["database"];

const POLICY = AUTH_POLICIES.signInLinkRequest; // 5 per 900 s
const WINDOW_MS = POLICY.windowSeconds * 1_000;
const SUBJECT = "panitia@masjid-alfalah.example";

/** A fixed instant, so "inside the window" and "after the window" are decided by arithmetic. */
const T0 = new Date("2026-09-27T02:00:00.000Z");

beforeAll(async () => {
  handle = await createTestDatabase();
  database = handle.database;
});

afterAll(async () => {
  await handle?.close();
});

// Counters are the only shared state in this suite: a bucket left behind by one test would silently
// change the limit seen by the next.
beforeEach(async () => {
  await database.execute(sql`DELETE FROM auth_rate_limit_counters`);
});

describe("durable rate limiting (T-ORG-001)", () => {
  test("allows exactly the configured number of requests in a window and refuses the next", async () => {
    const key = `test:limit:${crypto.randomUUID()}`;
    const outcomes: boolean[] = [];

    for (let attempt = 1; attempt <= POLICY.limit + 2; attempt += 1) {
      const decision = await consumeCounter(database, {
        bucketKey: key,
        limit: POLICY.limit,
        windowMs: WINDOW_MS,
        now: T0,
      });
      outcomes.push(decision.allowed);
    }

    expect(outcomes.slice(0, POLICY.limit)).toEqual(Array(POLICY.limit).fill(true));
    expect(outcomes.slice(POLICY.limit)).toEqual([false, false]);
  });

  test("reports a retry delay that fits inside the configured window", async () => {
    const key = `test:retry:${crypto.randomUUID()}`;
    await consumeCounter(database, { bucketKey: key, limit: 1, windowMs: WINDOW_MS, now: T0 });

    const refused = await consumeCounter(database, {
      bucketKey: key,
      limit: 1,
      windowMs: WINDOW_MS,
      now: new Date(T0.getTime() + 30_000),
    });

    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(WINDOW_MS - 30_000);
  });

  test("counts how much of the window is left rather than echoing the limit", async () => {
    const key = `test:remaining:${crypto.randomUUID()}`;
    const first = await consumeCounter(database, {
      bucketKey: key,
      limit: 3,
      windowMs: WINDOW_MS,
      now: T0,
    });
    const second = await consumeCounter(database, {
      bucketKey: key,
      limit: 3,
      windowMs: WINDOW_MS,
      now: T0,
    });
    const third = await consumeCounter(database, {
      bucketKey: key,
      limit: 3,
      windowMs: WINDOW_MS,
      now: T0,
    });

    expect([first.remaining, second.remaining, third.remaining]).toEqual([2, 1, 0]);
  });

  test("resets the window once it has elapsed instead of carrying the count forward", async () => {
    const key = `test:reset:${crypto.randomUUID()}`;
    // Fill all but one slot, so the next call is the last one the window still owes.
    for (let attempt = 0; attempt < POLICY.limit - 1; attempt += 1) {
      await consumeCounter(database, { bucketKey: key, limit: POLICY.limit, windowMs: WINDOW_MS, now: T0 });
    }
    const atTheLimit = await consumeCounter(database, {
      bucketKey: key,
      limit: POLICY.limit,
      windowMs: WINDOW_MS,
      now: T0,
    });
    expect(atTheLimit.allowed).toBe(true);
    expect(atTheLimit.remaining).toBe(0);

    // A refusal inside the window must not shift the window forward.
    const refused = await consumeCounter(database, {
      bucketKey: key,
      limit: POLICY.limit,
      windowMs: WINDOW_MS,
      now: new Date(T0.getTime() + 60_000),
    });
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(WINDOW_MS - 60_000);

    const afterTheWindow = await consumeCounter(database, {
      bucketKey: key,
      limit: POLICY.limit,
      windowMs: WINDOW_MS,
      now: new Date(T0.getTime() + WINDOW_MS + 1),
    });
    expect(afterTheWindow.allowed).toBe(true);
    expect(afterTheWindow.remaining).toBe(POLICY.limit - 1);
  });

  test("saturates the counter instead of growing it without bound under abuse", async () => {
    const key = `test:saturate:${crypto.randomUUID()}`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await consumeCounter(database, { bucketKey: key, limit: 2, windowMs: WINDOW_MS, now: T0 });
    }

    // Read the stored value back, so the assertion is about the row and not the returned decision.
    const rows = await database.execute<{ count: number }>(
      sql`SELECT count FROM auth_rate_limit_counters WHERE bucket_key = ${key}`,
    );

    expect(Number(rows.rows[0]?.count)).toBe(3); // limit + 1
  });

  test("counts survive a new storage instance, which is what a deploy would do", async () => {
    const key = `test:durable:${crypto.randomUUID()}`;
    const firstDeploy = createAuthRateLimitStorage(database as unknown as SqlExecutor);
    for (let attempt = 0; attempt < POLICY.limit; attempt += 1) {
      await firstDeploy.consume(key, { window: POLICY.windowSeconds, max: POLICY.limit });
    }

    const secondDeploy = createAuthRateLimitStorage(database as unknown as SqlExecutor);
    const decision = await secondDeploy.consume(key, {
      window: POLICY.windowSeconds,
      max: POLICY.limit,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfter).toBeGreaterThan(0);
  });

  test("refuses when the counter store cannot be reached instead of waving traffic through", async () => {
    const broken = {
      async execute(): Promise<{ rows: Record<string, unknown>[] }> {
        throw new Error("connection refused");
      },
    };
    const storage = createAuthRateLimitStorage(broken);

    const decision = await storage.consume("any", { window: 60, max: 10 });

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfter).toBe(60);
  });

  test("N concurrent requests consume N counts, so the limit is not bypassed", async () => {
    const key = `test:concurrent:${crypto.randomUUID()}`;
    const attempts = 40;

    const decisions = await Promise.all(
      Array.from({ length: attempts }, () =>
        consumeCounter(database, { bucketKey: key, limit: POLICY.limit, windowMs: WINDOW_MS, now: T0 }),
      ),
    );

    const allowed = decisions.filter((decision) => decision.allowed).length;
    expect(allowed).toBe(POLICY.limit);
    expect(decisions.filter((decision) => !decision.allowed).length).toBe(attempts - POLICY.limit);
  });

  test("never writes the raw subject into the bucket key", async () => {
    const key = authRateLimitBucketKey("signInLinkRequest", SUBJECT);

    expect(key).not.toContain(SUBJECT);
    expect(key).not.toContain("masjid-alfalah");
    expect(key).toMatch(/^auth:signInLinkRequest:[0-9a-f]{64}$/);

    await consumeAuthLimit("signInLinkRequest", SUBJECT, { database, now: T0 });

    const stored = await database.execute(
      sql`SELECT bucket_key FROM auth_rate_limit_counters WHERE bucket_key = ${key}`,
    );
    expect(stored.rows).toHaveLength(1);

    // A LIKE scan is deliberately not anchored to the policy prefix: if a raw subject ever reached
    // the table, this is the query that would find it.
    const raw = await database.execute<{ hits: number }>(
      sql`SELECT count(*)::int AS hits FROM auth_rate_limit_counters WHERE bucket_key LIKE ${`%${SUBJECT}%`}`,
    );
    expect(Number(raw.rows[0]?.hits)).toBe(0);
  });

  test("deletes counters whose window has closed and keeps the ones still in use", async () => {
    const stale = `test:sweep-stale:${crypto.randomUUID()}`;
    const fresh = `test:sweep-fresh:${crypto.randomUUID()}`;
    await consumeCounter(database, { bucketKey: stale, limit: POLICY.limit, windowMs: WINDOW_MS, now: T0 });
    await consumeCounter(database, {
      bucketKey: fresh,
      limit: POLICY.limit,
      windowMs: WINDOW_MS,
      now: new Date(T0.getTime() + 3_600_000),
    });

    const deleted = await deleteExpiredCounters(database, {
      olderThan: new Date(T0.getTime() + 1_800_000),
    });

    expect(deleted).toBe(1);

    const survivors = await database.execute<{ bucket_key: string }>(
      sql`SELECT bucket_key FROM auth_rate_limit_counters WHERE bucket_key = ${fresh}`,
    );
    expect(survivors.rows).toHaveLength(1);
  });
});
