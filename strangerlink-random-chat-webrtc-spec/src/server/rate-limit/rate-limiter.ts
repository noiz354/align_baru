/**
 * Rate limiting — real implementation.
 *
 * Requirements:
 * - FR-SAFE-001, FR-ABUSE-001
 * - T-ABUSE-061, T-ABUSE-062
 * - ADR-003, ADR-012
 * - ABUSE_PREVENTION.md §2, SECURITY.md §9
 *
 * All limits per identity, not per connection (T-24).
 * Every trigger records SafetyEvent.
 */

import { rateLimitStore, safetyEventStore, riskSignalStore } from '../db/in-memory';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

export const RATE_LIMITS = {
  websocketFramesPerSecond: 30,
  websocketFrameBurst: 60,
  maxPayloadBytes: 64 * 1024,
  queueJoinsPerSecond: 1,
  queueJoinIntervalSeconds: 5,
  sessionCreationsPerMinute: 10,
  messagesPerSecond: 1,
  messageBurst: 5,
  messagesPerSession: 300,
  reportsPerHour: 5,
  blocksPerHour: 10,
  turnCredentialsPerSession: 1,
  turnCredentialsPerHour: 5,
  offersPerSession: 10,
  iceCandidatesPerSession: 100,
  identityCreationsPerMinute: 5,
  connectionAttemptsPerMinute: 10,
} as const;

export const COOLDOWN_LADDER = [
  { triggersWithin60s: 3, durationMs: 30_000 },
  { triggersWithin60s: 5, durationMs: 300_000 },
  { escalated: true, durationMs: 60_000 },
  { escalated: true, durationMs: 600_000 },
  { escalated: true, durationMs: 3_600_000 },
] as const;

export interface RateLimiterPort {
  check(
    identityId: string,
    limitName: keyof typeof RATE_LIMITS,
  ): Promise<RateLimitResult>;
  applyCooldown(identityId: string, durationMs: number): Promise<void>;
  cooldownRemaining(identityId: string): Promise<number>;
}

export const createRateLimiterPort = (): RateLimiterPort => ({
  async check(identityId: string, limitName: keyof typeof RATE_LIMITS): Promise<RateLimitResult> {
    const res = rateLimitStore.check(identityId, limitName);
    if (!res.allowed) {
      safetyEventStore.record('rate-limit-triggered', identityId, null, {
        limitName,
        retryAfterMs: res.retryAfterMs ?? 0,
      });
    }
    return res;
  },
  async applyCooldown(identityId: string, durationMs: number): Promise<void> {
    rateLimitStore.applyCooldown(identityId, durationMs);
    safetyEventStore.record('rate-limit-triggered', identityId, null, {
      limitName: 'cooldown',
      durationMs,
    });
  },
  async cooldownRemaining(identityId: string): Promise<number> {
    return rateLimitStore.cooldownRemaining(identityId);
  },
});

export const createNotImplementedRateLimiterPort = createRateLimiterPort;

export interface RiskSignal {
  hash: string;
  regionCode: string | null;
  expiresAt: Date;
}

export interface RiskSignalPort {
  record(identityId: string, rawSignal: string): Promise<RiskSignal>;
  findActive(hash: string): Promise<RiskSignal | null>;
}

export const createRiskSignalPort = (): RiskSignalPort => ({
  async record(identityId: string, rawSignal: string): Promise<RiskSignal> {
    // Coarse, one-way hash, 7 days, rate-limit/cooldown only — never standalone ban (ADR-012 MR-2)
    const rec = riskSignalStore.record(identityId, rawSignal);
    return {
      hash: rec.hash,
      regionCode: rec.regionCode,
      expiresAt: rec.expiresAt,
    };
  },
  async findActive(hash: string): Promise<RiskSignal | null> {
    const found = riskSignalStore.findActive(hash);
    if (!found) return null;
    return {
      hash: found.hash,
      regionCode: found.regionCode,
      expiresAt: found.expiresAt,
    };
  },
});

export const createNotImplementedRiskSignalPort = createRiskSignalPort;
