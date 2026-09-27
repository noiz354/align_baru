/**
 * Durable rate-limit counter store.
 *
 * Where this belongs: server/db/repositories — it is the only writer of `auth_rate_limit_counters`.
 *
 * Why it exists: ADR-0005 records that Better Auth's default limiter is in-memory and resets on
 * deploy, which SECURITY.md §13 calls unacceptable. A row per bucket is the smallest store that is
 * shared across replicas and survives a restart, and Postgres is already the system of record
 * (ADR-0010: no Redis for MVP).
 *
 * Invariants:
 *   1. **One statement.** The read, the window reset and the increment happen in a single
 *      `INSERT … ON CONFLICT DO UPDATE … RETURNING`. N concurrent requests must consume N distinct
 *      counts; a read-then-write would let every reader see a stale count and all pass.
 *   2. **The counter is bounded.** It saturates at `limit + 1`, so a sustained flood cannot grow the
 *      row without bound, while still distinguishing "the request that reached the limit" (allowed)
 *      from "a request after it" (refused).
 *   3. **A refusal never extends the window.** Only a window reset moves `window_started_at`, so
 *      retrying does not punish a caller further than the configured window.
 *   4. **The bucket key is opaque.** Callers hash the subject before it reaches this module
 *      (PRIVACY.md: an email or device id must not be written here in the clear).
 *
 * Failure cases: database unavailable → the caller sees a rejected promise and must fail closed
 * (SECURITY.md §13: never a silent allow).
 *
 * Task ownership: T-ORG-001 (auth limiter). `src/server/http/rate-limit.ts` reuses this store for the
 * check-in and registration policies when T-SEC-010 lands.
 */
import { sql } from "drizzle-orm";

import type { SqlExecutor } from "@/server/db/client";

export interface ConsumeCounterInput {
  /** Opaque bucket key: `${policyKey}:${hashedSubject}:${windowIndex}`. Never a raw identifier. */
  readonly bucketKey: string;
  /** Maximum number of allowed requests in the window. */
  readonly limit: number;
  readonly windowMs: number;
  /** Server time, injected — never read from the clock inside this module (ADR-0018). */
  readonly now: Date;
}

export interface CounterDecision {
  readonly allowed: boolean;
  /** Milliseconds until the current window frees up. Absent when the request was allowed. */
  readonly retryAfterMs?: number;
  readonly remaining: number;
}

interface CounterRow {
  count: number;
  window_started_at: Date | string;
}

/**
 * Consume one unit from the bucket, atomically.
 *
 * @throws if the database is unreachable — callers must treat that as a refusal (fail closed).
 */
export async function consumeCounter(
  database: SqlExecutor,
  input: ConsumeCounterInput,
): Promise<CounterDecision> {
  const { bucketKey, limit, windowMs, now } = input;

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("rate limit must be a positive integer");
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("rate limit window must be a positive integer number of milliseconds");
  }

  const nowIso = now.toISOString();
  const windowStartBoundaryIso = new Date(now.getTime() - windowMs).toISOString();
  const saturatedCount = limit + 1;

  const result = await database.execute(sql`
    INSERT INTO auth_rate_limit_counters (bucket_key, count, window_started_at, updated_at)
    VALUES (${bucketKey}, 1, ${nowIso}::timestamptz, ${nowIso}::timestamptz)
    ON CONFLICT (bucket_key) DO UPDATE SET
      count = CASE
        WHEN auth_rate_limit_counters.window_started_at <= ${windowStartBoundaryIso}::timestamptz THEN 1
        ELSE LEAST(auth_rate_limit_counters.count + 1, ${saturatedCount})
      END,
      window_started_at = CASE
        WHEN auth_rate_limit_counters.window_started_at <= ${windowStartBoundaryIso}::timestamptz
          THEN ${nowIso}::timestamptz
        ELSE auth_rate_limit_counters.window_started_at
      END,
      updated_at = ${nowIso}::timestamptz
    RETURNING count, window_started_at
  `);

  const row = result.rows[0] as CounterRow | undefined;
  if (!row) {
    // `RETURNING` on a successful INSERT … ON CONFLICT always yields a row. Reaching here means the
    // database did not do what we asked, and the safe answer is "no".
    return { allowed: false, retryAfterMs: windowMs, remaining: 0 };
  }

  const count = Number(row.count);
  const windowStartedAt = new Date(row.window_started_at).getTime();
  const allowed = count <= limit;

  if (allowed) {
    return { allowed, remaining: Math.max(0, limit - count) };
  }

  return {
    allowed: false,
    retryAfterMs: Math.max(0, windowStartedAt + windowMs - now.getTime()),
    remaining: 0,
  };
}

/**
 * Delete buckets whose window has definitively closed.
 *
 * The counters are abuse data with a short purpose (`RETENTION.md`); leaving them forever would turn
 * a rate limiter into a silent record of who tried what. Called by the retention job — that job is
 * T-PRIV-003, so until it runs this is exercised by its own test rather than by production code.
 */
export async function deleteExpiredCounters(
  database: SqlExecutor,
  input: { readonly olderThan: Date },
): Promise<number> {
  const result = await database.execute(sql`
    DELETE FROM auth_rate_limit_counters
    WHERE updated_at < ${input.olderThan.toISOString()}::timestamptz
    RETURNING bucket_key
  `);
  return result.rows.length;
}
