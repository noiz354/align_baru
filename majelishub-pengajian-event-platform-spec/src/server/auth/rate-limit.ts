/**
 * Auth-specific rate limiting policies (sign-in links, passkey challenges, token attempts).
 *
 * Where this belongs: server/auth; the mechanism is src/server/http/rate-limit.ts (durable store).
 * Specification: SECURITY.md §13, TASKS.md T-SEC-010, docs/research/STACK-2026.md §6 and ADR-0005,
 *   which both record the same operational warning: Better Auth's default limiter is in-memory and
 *   resets on deploy, so it must be replaced by a durable store before production.
 *
 * Invariants:
 *   1. The in-memory default of the auth library is FORBIDDEN in production (`config()` refuses
 *      `RATE_LIMIT_STORE=memory` when NODE_ENV=production).
 *   2. Limits are shared across replicas: the counter lives in `rate_limit_buckets`, one statement
 *      per attempt (no read-then-write race).
 *   3. Failures are explicit and never silently allow: `allowed: false` carries `retryAfterMs`, and a
 *      store error propagates instead of returning "allowed".
 *   4. The stored key is an HMAC of Better Auth's key (which contains the client IP), so no raw IP is
 *      written to the database (SECURITY.md §11).
 *
 * Task ownership: T-ORG-001 (delivered 2026-09-27 - durable store wired into the auth instance),
 * T-SEC-010 (replica hardening, `rate_limit_rejections_total` metric, bucket cleanup job).
 */
import { rateLimitBuckets } from "@/server/db/schema";
import { bucketHash, consumeBucket, type RateLimitDecision } from "@/server/http/rate-limit";
import { getDb, type DbHandle } from "@/server/db/client";
import { config } from "@/server/config";
import { eq } from "drizzle-orm";

export const AUTH_POLICIES = {
  signInLinkRequest: { limit: 5, windowSeconds: 900 },
  passkeyChallenge: { limit: 20, windowSeconds: 300 },
  checkInSessionBind: { limit: 10, windowSeconds: 600 },
} as const;

export type AuthPolicyKey = keyof typeof AUTH_POLICIES;

/** Consume one unit of an auth policy for a dimension value (device id, hashed IP, user id). */
export async function consumeAuthLimitOn(
  handle: DbHandle,
  key: AuthPolicyKey,
  value: string,
  now?: Date,
): Promise<RateLimitDecision> {
  const policy = AUTH_POLICIES[key];
  return consumeBucket(handle, {
    key: `rl:auth:${key}:${bucketHash(value, config().rateLimitSalt)}`,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
    ...(now ? { now } : {}),
  });
}

/** Same, on the process-wide connection. */
export async function consumeAuthLimit(
  key: AuthPolicyKey,
  value: string,
  now?: Date,
): Promise<RateLimitDecision> {
  return consumeAuthLimitOn(getDb(), key, value, now);
}

/**
 * The durable rate-limit store handed to Better Auth as `rateLimit.customStorage`.
 *
 * `consume` is the atomic path Better Auth prefers; `get`/`set` exist because the library still
 * supports storages without it, and because a custom storage replaces the built-in one entirely
 * (its `storage: "memory" | "database"` option is ignored once `customStorage` is set).
 *
 * The value Better Auth stores (`{ key, count, lastRequest }`) is mapped onto the same bucket table.
 */
export function createDurableAuthRateLimitStorage(handle: DbHandle) {
  const salt = config().rateLimitSalt;
  const hashKey = (key: string): string => `rl:auth-lib:${bucketHash(key, salt)}`;

  return {
    async get(key: string) {
      const rows = await handle
        .select({ bucketKey: rateLimitBuckets.bucketKey, hits: rateLimitBuckets.hits, windowStart: rateLimitBuckets.windowStart })
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.bucketKey, hashKey(key)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return { key, count: row.hits, lastRequest: row.windowStart.getTime() };
    },

    async set(key: string, value: { key: string; count: number; lastRequest: number }) {
      const bucketKey = hashKey(key);
      await handle
        .insert(rateLimitBuckets)
        .values({ bucketKey, hits: value.count, windowStart: new Date(value.lastRequest), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: rateLimitBuckets.bucketKey,
          set: { hits: value.count, windowStart: new Date(value.lastRequest), updatedAt: new Date() },
        });
    },

    /** Atomic: the check and the increment are one statement, so concurrent requests cannot bypass. */
    async consume(key: string, rule: { window: number; max: number }) {
      const decision = await consumeBucket(handle, {
        key: hashKey(key),
        limit: rule.max,
        windowSeconds: rule.window,
      });
      return {
        allowed: decision.allowed,
        retryAfter: decision.retryAfterMs === undefined ? null : Math.ceil(decision.retryAfterMs / 1000),
      };
    },
  };
}
