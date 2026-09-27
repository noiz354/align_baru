/**
 * Durable rate limiting (shared across replicas) with explicit, documented thresholds.
 *
 * Where this belongs: server/http (transport concern). Policy values live with the feature that needs
 * them (check-in, registration, auth).
 * Specification: SECURITY.md §13, API.md §Rate limits, TASKS.md T-PERF-002/T-REG-009/T-SEC-010,
 *   docs/research/STACK-2026.md §6 (the library's in-memory limiter is forbidden in production).
 *
 * Invariants implemented (T-ORG-001 delivers the durable mechanism; T-SEC-010 owns replica-level
 * hardening, metrics and the cleanup job):
 *   1. The store is Postgres - one row per (policy, dimension value, window) in `rate_limit_buckets`.
 *   2. Check and increment happen in ONE statement (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`),
 *      so N concurrent requests cannot all pass a stale read.
 *   3. Keys are bucketed by the correct dimension and the dimension value is HMAC-hashed before it is
 *      stored, so no raw IP address ever reaches the database (SECURITY.md §11).
 *   4. A rejection is explicit (`allowed: false` + `retryAfterMs`); it is never a false success and
 *      never a silent drop. The caller maps it to `RATE_LIMITED` (429 + `Retry-After`).
 *   5. Fixed windows: the window start is derived from the clock, so two replicas compute the same
 *      bucket without coordinating.
 *
 * Failure cases: store unavailable -> the error propagates (fail closed for the paths that call it;
 * the entrance keeps its manual/paper path, see docs/architecture/FAILURE-MODEL.md) · burst from one
 * shared network -> the DEVICE/EVENT dimensions keep a mosque's Wi-Fi from locking out participants.
 * Task ownership: T-ORG-001 (mechanism), T-SEC-010 (replica hardening + metrics), T-PERF-002, T-REG-009.
 */
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { rateLimitBuckets } from "@/server/db/schema";
import { getDb, type DbHandle } from "@/server/db/client";
import { config } from "@/server/config";

export interface RateLimitPolicy {
  readonly key: string;
  readonly dimension: "DEVICE" | "EVENT" | "CONTACT_HASH" | "IP_HASH" | "USER";
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
  readonly remaining?: number;
}

/**
 * HMAC the dimension value with the deployment's rotating salt. Two consequences we want: a raw IP or
 * contact hash is never written to a row, and rotating the salt forgets every counter (documented in
 * OPERATIONS.md §Rotation).
 */
export function bucketHash(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

/** Fixed-window start (epoch seconds) for a timestamp: identical on every replica. */
export function windowStartEpochSeconds(nowMs: number, windowSeconds: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
}

export interface ConsumeInput {
  /** Full bucket key, already namespaced. Values inside it are hashed before storage. */
  readonly key: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly now?: Date;
}

/**
 * The durable counter. One statement, atomic, returns the decision.
 *
 * @throws when the store is unreachable - a rate limiter that cannot count must not silently allow.
 */
export async function consumeBucket(handle: DbHandle, input: ConsumeInput): Promise<RateLimitDecision> {
  const now = input.now ?? new Date();
  const startEpoch = windowStartEpochSeconds(now.getTime(), input.windowSeconds);
  const windowStart = new Date(startEpoch * 1000);
  const bucketKey = `${input.key}:${startEpoch}`;

  const rows = await handle
    .insert(rateLimitBuckets)
    .values({ bucketKey, windowStart, hits: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: rateLimitBuckets.bucketKey,
      set: {
        hits: sql`CASE WHEN ${rateLimitBuckets.windowStart} = excluded.window_start THEN ${rateLimitBuckets.hits} + 1 ELSE 1 END`,
        windowStart: sql`excluded.window_start`,
        updatedAt: now,
      },
    })
    .returning({ hits: rateLimitBuckets.hits });

  const row = rows[0];
  if (!row) throw new Error("Programming error: rate-limit upsert returned no row");

  const allowed = row.hits <= input.limit;
  const windowEndMs = (startEpoch + input.windowSeconds) * 1000;
  const retryAfterMs = Math.max(0, windowEndMs - now.getTime());
  const remaining = Math.max(0, input.limit - row.hits);

  return allowed
    ? { allowed: true, remaining }
    : { allowed: false, retryAfterMs, remaining: 0 };
}

/** Consume one unit of a documented policy for a dimension value. */
export async function consumeOn(
  handle: DbHandle,
  policy: RateLimitPolicy,
  value: string,
  now?: Date,
): Promise<RateLimitDecision> {
  const salt = config().rateLimitSalt;
  return consumeBucket(handle, {
    key: `rl:${policy.key}:${policy.dimension}:${bucketHash(value, salt)}`,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    ...(now ? { now } : {}),
  });
}

/** Same, on the process-wide connection. */
export async function consume(policy: RateLimitPolicy, value: string, now?: Date): Promise<RateLimitDecision> {
  return consumeOn(getDb(), policy, value, now);
}

/** Documented policies (thresholds tied to the performance budgets P11-P16). */
export const POLICIES: readonly RateLimitPolicy[] = [
  { key: "checkin.validate.device", dimension: "DEVICE", limit: 120, windowSeconds: 60 },
  { key: "checkin.validate.event", dimension: "EVENT", limit: 300, windowSeconds: 60 },
  { key: "checkin.validate.ip", dimension: "IP_HASH", limit: 200, windowSeconds: 60 },
  { key: "registration.create.contact", dimension: "CONTACT_HASH", limit: 3, windowSeconds: 600 },
  { key: "registration.create.ip", dimension: "IP_HASH", limit: 20, windowSeconds: 600 },
  { key: "auth.request.ip", dimension: "IP_HASH", limit: 10, windowSeconds: 600 },
];

export function policyByKey(key: string): RateLimitPolicy | undefined {
  return POLICIES.find((policy) => policy.key === key);
}
