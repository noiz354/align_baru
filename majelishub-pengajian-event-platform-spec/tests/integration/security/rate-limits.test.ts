/**
 * INTEGRATION TEST - security/rate-limits.test.ts
 * Layer: integration (real PostgreSQL) · Owning task: T-ORG-001 (durable mechanism) · Requirement(s): NFR-SEC-010, NFR-SEC-001
 * Specification: SECURITY.md §13, API.md §Rate limits, docs/research/STACK-2026.md §6, ADR-0005
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * The clock is fixed (an explicit `now` on every call), so no test depends on when it runs and none of
 * them sleeps (TESTING.md §1.5).
 *
 * Why these behaviours: the auth library's in-memory limiter resets on deploy and is not shared between
 * replicas; a mosque entrance must not be throttled by its own success, and abuse must be stopped.
 *
 * Delivered 2026-09-27 (T-ORG-001). Replica-level hardening, the rejection metric and the bucket cleanup
 * job remain T-SEC-010.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import "../../support/env";
import { createTestDatabase, type TestDatabase } from "../../support/db";
import { AUTH_POLICIES, consumeAuthLimitOn, createDurableAuthRateLimitStorage } from "@/server/auth/rate-limit";
import { bucketHash, consumeOn, policyByKey, windowStartEpochSeconds } from "@/server/http/rate-limit";
import { config } from "@/server/config";
import { AppError, ErrorCode } from "@/shared/contracts/errors";

/** Fixed clock: 2026-09-27T03:04:05Z. Every assertion below is independent of the real time. */
const NOW = new Date("2026-09-27T03:04:05.000Z");

let harness: TestDatabase;

beforeAll(async () => {
  harness = await createTestDatabase();
});

afterAll(async () => {
  await harness.close();
});

describe("rate limits", () => {
  test("enforces the documented thresholds on every attempt path", async () => {
    // Auth policies (src/server/auth/rate-limit.ts AUTH_POLICIES).
    for (const key of Object.keys(AUTH_POLICIES) as (keyof typeof AUTH_POLICIES)[]) {
      const policy = AUTH_POLICIES[key];
      for (let attempt = 1; attempt <= policy.limit; attempt += 1) {
        const decision = await consumeAuthLimitOn(harness.db, key, `device-${key}`, NOW);
        expect(decision.allowed, `${key} attempt ${attempt}`).toBe(true);
        expect(decision.remaining).toBe(policy.limit - attempt);
      }
      const denied = await consumeAuthLimitOn(harness.db, key, `device-${key}`, NOW);
      expect(denied.allowed, `${key} attempt ${policy.limit + 1}`).toBe(false);

      // A different dimension value is not punished by the first one's attempts.
      const otherValue = await consumeAuthLimitOn(harness.db, key, `device-other-${key}`, NOW);
      expect(otherValue.allowed).toBe(true);
    }

    // The transport policies (API.md §Rate limits) behave the same way.
    const contactPolicy = policyByKey("registration.create.contact");
    expect(contactPolicy).toBeDefined();
    if (contactPolicy) {
      for (let attempt = 1; attempt <= contactPolicy.limit; attempt += 1) {
        expect((await consumeOn(harness.db, contactPolicy, "contact-hash-1", NOW)).allowed).toBe(true);
      }
      expect((await consumeOn(harness.db, contactPolicy, "contact-hash-1", NOW)).allowed).toBe(false);
    }
  });

  test("shares counters across replicas (durable store, not in-memory)", async () => {
    // Two independent limiter instances over the same database stand in for two replicas: the counter
    // lives in the table, so the second instance continues where the first stopped.
    const replicaA = createDurableAuthRateLimitStorage(harness.db);
    const replicaB = createDurableAuthRateLimitStorage(harness.db);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const decision = await replicaA.consume("sign-in/email:shared-counter", { window: 900, max: 5 });
      expect(decision.allowed).toBe(true);
    }
    const fromB = await replicaB.consume("sign-in/email:shared-counter", { window: 900, max: 5 });
    expect(fromB.allowed).toBe(true);
    const exhausted = await replicaB.consume("sign-in/email:shared-counter", { window: 900, max: 5 });
    expect(exhausted.allowed).toBe(true); // 5th attempt
    const sixth = await replicaA.consume("sign-in/email:shared-counter", { window: 900, max: 5 });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfter).toBeGreaterThan(0);

    // The database, not the process, decides: one attempt creates the row, tampering with it flips the
    // next decision even though this process has made only one attempt for that value.
    await consumeAuthLimitOn(harness.db, "passkeyChallenge", "tampered-device", NOW);
    const startEpoch = windowStartEpochSeconds(NOW.getTime(), AUTH_POLICIES.passkeyChallenge.windowSeconds);
    const bucketKey = `rl:auth:passkeyChallenge:${bucketHash("tampered-device", config().rateLimitSalt)}:${startEpoch}`;
    await harness.exec(`UPDATE rate_limit_buckets SET hits = 999 WHERE bucket_key = '${bucketKey}'`);
    const afterTamper = await consumeAuthLimitOn(harness.db, "passkeyChallenge", "tampered-device", NOW);
    expect(afterTamper.allowed).toBe(false);

    const rows = await harness.query<{ n: number }>("SELECT count(*)::int AS n FROM rate_limit_buckets");
    expect((rows[0]?.n ?? 0)).toBeGreaterThan(0);
  });

  test("does not throttle the target scan rate (>= 200/min/event) under normal load", async () => {
    const policy = policyByKey("checkin.validate.event");
    expect(policy).toBeDefined();
    if (!policy) return;

    // P11-P16 budget: 200 scans per minute for one event must all pass.
    for (let scan = 1; scan <= 200; scan += 1) {
      const decision = await consumeOn(harness.db, policy, "event-entrance-burst", NOW);
      expect(decision.allowed, `scan ${scan}`).toBe(true);
    }
    const after = await consumeOn(harness.db, policy, "event-entrance-burst", NOW);
    expect(after.allowed).toBe(true); // 201st of 300
    expect(after.remaining).toBe(policy.limit - 201);
  });

  test("returns RATE_LIMITED with retry guidance and never a false success", async () => {
    const policy = policyByKey("auth.request.ip");
    expect(policy).toBeDefined();
    if (!policy) return;

    for (let attempt = 0; attempt < policy.limit; attempt += 1) {
      await consumeOn(harness.db, policy, "203.0.113.7", NOW);
    }
    const denied = await consumeOn(harness.db, policy, "203.0.113.7", NOW);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(policy.windowSeconds * 1000);

    const error = AppError.rateLimited(Math.ceil((denied.retryAfterMs ?? 0) / 1000));
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.httpStatus).toBe(429);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);

    // Privacy: the raw client address never reaches the database (SECURITY.md §11).
    const leaked = await harness.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM rate_limit_buckets WHERE bucket_key LIKE '%203.0.113.7%'",
    );
    expect(leaked[0]?.n).toBe(0);
  });
});
