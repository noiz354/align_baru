/**
 * Auth-specific rate limiting policies (sign-in attempts, passkey challenges, token attempts).
 *
 * Where this belongs: server/auth; the mechanism is src/server/db/repositories/
 * auth-rate-limit-counters.ts (a durable store), and the HTTP-layer policies live in
 * src/server/http/rate-limit.ts (T-SEC-010).
 * Specification: SECURITY.md §13, TASKS.md T-SEC-010, ADR-0005 ("its default rate limiter is
 *   in-memory and resets on deploy — unacceptable in production").
 *
 * Invariants:
 *   1. The store is Postgres. The library's in-memory default is never enabled, in any environment,
 *      because a limiter that forgets on deploy is not a limiter.
 *   2. A failure to reach the store is a **refusal**, never a silent allow.
 *   3. The subject (an email, a device id, an IP) is hashed before it becomes a bucket key, so the
 *      counter table never holds an identifier in the clear (PRIVACY.md, OBSERVABILITY.md §7).
 *
 * Task ownership: T-SEC-010, T-ORG-001.
 *
 * WHY THIS FILE EXISTS NEXT TO `src/server/auth/rate-limit.ts`
 *   `main` and this branch both delivered T-ORG-001's durable limiter, against two tables:
 *   `auth_rate_limit_counters` (here, with `consumeCounter`/`deleteExpiredCounters` - including the
 *   saturation and window-cleanup behaviour its suite asserts) and `rate_limit_buckets`
 *   (`src/server/http/rate-limit.ts`, used by the HTTP-dimension policies and by Better Auth's
 *   `customStorage`). The 2026-09-27 merge kept both rather than silently dropping either suite's
 *   coverage; the policies are identical (`AUTH_POLICIES` below and in `rate-limit.ts` agree), so
 *   consolidating onto one table is a mechanical follow-up owned by T-SEC-010, which also owns the
 *   rejection metric.
 */
import { consumeCounter } from "@/server/db/repositories/auth-rate-limit-counters";
import { hashSubject } from "@/server/crypto/subject-hash";
import { getDb, type SqlExecutor } from "@/server/db/client";

/**
 * Adapts the production Drizzle handle to the narrow `SqlExecutor` the counter repository takes.
 *
 * The cast is at the driver boundary and is the same one the repository's own row reads make: Drizzle
 * types `execute()` as `unknown` because the two drivers disagree on the result shape, while the SQL in
 * the repository knows exactly which columns it selected.
 */
function defaultExecutor(): SqlExecutor {
  const handle = getDb();
  return {
    execute: async (query) => (await handle.execute(query)) as { rows: Record<string, unknown>[] },
  };
}

export const AUTH_POLICIES = {
  signInLinkRequest: { limit: 5, windowSeconds: 900 },
  passkeyChallenge: { limit: 20, windowSeconds: 300 },
  checkInSessionBind: { limit: 10, windowSeconds: 600 },
} as const;

export type AuthPolicyKey = keyof typeof AUTH_POLICIES;

export interface ConsumeAuthLimitOptions {
  /**
   * Injected clock. Omitting it uses the adapter's real time — this module is an infrastructure
   * adapter, so reading the clock here is allowed; domain code still injects (ADR-0018).
   */
  readonly now?: Date;
  /** Overrides the pooled client. Used by tests, which run against an embedded Postgres. */
  readonly database?: SqlExecutor;
}

const SUBJECT_PURPOSE = "majelishub.rate-limit.v1";

/** Builds the opaque bucket key. Exported so tests can assert that no raw subject is stored. */
export function authRateLimitBucketKey(policy: AuthPolicyKey, value: string): string {
  return `auth:${policy}:${hashSubject(SUBJECT_PURPOSE, value)}`;
}

export async function consumeAuthLimit(
  key: AuthPolicyKey,
  value: string,
  options: ConsumeAuthLimitOptions = {},
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const policy = AUTH_POLICIES[key];
  const now = options.now ?? new Date();

  const decision = await consumeCounter(options.database ?? defaultExecutor(), {
    bucketKey: authRateLimitBucketKey(key, value),
    limit: policy.limit,
    windowMs: policy.windowSeconds * 1_000,
    now,
  });

  if (decision.allowed) return { allowed: true };
  return decision.retryAfterMs === undefined
    ? { allowed: false }
    : { allowed: false, retryAfterMs: decision.retryAfterMs };
}

/**
 * The rate-limit storage handed to Better Auth.
 *
 * Better Auth builds the key (path + client identifier) and owns the per-path rules; we own the
 * counting. Returning this from `rateLimit.customStorage` means the library's own endpoints —
 * sign-in, token refresh, everything under `/api/auth/*` — are limited by the same durable store as
 * the policies above, instead of by an in-process `Map`.
 *
 * `retryAfter` is in seconds, which is what the library's contract specifies.
 */
export function createAuthRateLimitStorage(database?: SqlExecutor): {
  consume: (
    key: string,
    rule: { window: number; max: number },
  ) => Promise<{ allowed: boolean; retryAfter: number | null }>;
} {
  const resolve = (): SqlExecutor => database ?? defaultExecutor();

  return {
    async consume(key, rule) {
      const now = new Date();
      try {
        const decision = await consumeCounter(resolve(), {
          bucketKey: `better-auth:${key}`,
          limit: rule.max,
          windowMs: rule.window * 1_000,
          now,
        });
        if (decision.allowed) return { allowed: true, retryAfter: null };
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((decision.retryAfterMs ?? rule.window * 1_000) / 1_000)),
        };
      } catch {
        // SECURITY.md §13: a limiter that cannot decide must not wave traffic through.
        return { allowed: false, retryAfter: rule.window };
      }
    },
  };
}
