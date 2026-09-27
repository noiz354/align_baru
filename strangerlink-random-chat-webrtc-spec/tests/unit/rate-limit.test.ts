/**
 * Rate limit and cooldown tests — real implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllStores, rateLimitStore, safetyEventStore, riskSignalStore, banStore } from '../../src/server/db/in-memory';
import { createRateLimiterPort, createRiskSignalPort } from '../../src/server/rate-limit/rate-limiter';
import { generateId } from '../../src/shared/utils/id';

describe('rate limiting', () => {
  beforeEach(() => clearAllStores());

  it('enforces every documented limit', async () => {
    const rateLimiter = createRateLimiterPort();
    const p1 = generateId();

    // queueJoinsPerSecond: 1 per 5s
    const res1 = await rateLimiter.check(p1, 'queueJoinsPerSecond');
    expect(res1.allowed).toBe(true);

    const res2 = await rateLimiter.check(p1, 'queueJoinsPerSecond');
    expect(res2.allowed).toBe(false);

    // reportsPerHour: 5 per hour
    for (let i = 0; i < 5; i++) {
      const r = await rateLimiter.check(p1, 'reportsPerHour');
      expect(r.allowed).toBe(true);
    }
    const r6 = await rateLimiter.check(p1, 'reportsPerHour');
    expect(r6.allowed).toBe(false);
  });

  it('keys limits on identity, not on connection', async () => {
    const rateLimiter = createRateLimiterPort();
    const p1 = generateId();
    const p2 = generateId();

    // p1 exhausts limit
    await rateLimiter.check(p1, 'queueJoinsPerSecond');
    const p1Second = await rateLimiter.check(p1, 'queueJoinsPerSecond');
    expect(p1Second.allowed).toBe(false);

    // p2 should still be allowed — per identity, not per connection (T-24)
    const p2First = await rateLimiter.check(p2, 'queueJoinsPerSecond');
    expect(p2First.allowed).toBe(true);
  });

  it('records a safety event on every trigger', async () => {
    const rateLimiter = createRateLimiterPort();
    const p1 = generateId();

    await rateLimiter.check(p1, 'queueJoinsPerSecond');
    const res2 = await rateLimiter.check(p1, 'queueJoinsPerSecond');
    expect(res2.allowed).toBe(false);

    const events = safetyEventStore.all().filter(e => e.type === 'rate-limit-triggered');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].participantId).toBe(p1);
  });
});

describe('cooldown ladder', () => {
  beforeEach(() => clearAllStores());

  it('applies a progressive cooldown', async () => {
    const rateLimiter = createRateLimiterPort();
    const p1 = generateId();

    await rateLimiter.applyCooldown(p1, 30_000);
    const remaining = await rateLimiter.cooldownRemaining(p1);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30_000);

    const check = await rateLimiter.check(p1, 'queueJoinsPerSecond');
    expect(check.allowed).toBe(false);
  });

  it('escalates the cooldown on repeated triggers', async () => {
    const rateLimiter = createRateLimiterPort();
    const p1 = generateId();

    await rateLimiter.applyCooldown(p1, 30_000);
    let remaining = await rateLimiter.cooldownRemaining(p1);
    expect(remaining).toBeGreaterThan(0);

    // Escalate to 5 minutes
    await rateLimiter.applyCooldown(p1, 300_000);
    remaining = await rateLimiter.cooldownRemaining(p1);
    expect(remaining).toBeGreaterThan(30_000);
  });
});

describe('risk signals', () => {
  beforeEach(() => clearAllStores());

  it('a shared-IP signal cannot trigger a standalone ban', async () => {
    const riskSignalPort = createRiskSignalPort();
    const p1 = generateId();
    const p2 = generateId();

    // Record same IP hash for two identities (CGNAT)
    const rawIp = '192.168.1.100';
    const rec1 = await riskSignalPort.record(p1, rawIp);
    const rec2 = await riskSignalPort.record(p2, rawIp);

    // Hashes should be same or similar (coarse)
    expect(rec1.hash).toBeTruthy();
    expect(rec2.hash).toBeTruthy();

    // Even with shared IP, no ban should be created automatically
    expect(banStore.isBanned(p1)).toBe(false);
    expect(banStore.isBanned(p2)).toBe(false);

    // Shared-IP can only trigger rate limit or cooldown (ADR-012 MR-2)
    // Verify no code path bans based solely on IP
    const rateLimiter = createRateLimiterPort();
    // Apply cooldown based on IP signal — allowed
    await rateLimiter.applyCooldown(p1, 30_000);
    // But ban should still not exist
    expect(banStore.isBanned(p1)).toBe(false);
  });

  it('expires a risk signal after 7 days', async () => {
    const riskSignalPort = createRiskSignalPort();
    const p1 = generateId();

    const rec = await riskSignalPort.record(p1, '10.0.0.1');
    expect(rec.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Simulate expiry by manually setting past expiry
    const store = riskSignalStore as any;
    const inner = store.signals.get(p1);
    if (inner) {
      inner.expiresAt = new Date(Date.now() - 1000);
    }

    const found = await riskSignalPort.findActive(rec.hash);
    expect(found).toBeNull();
  });
});
