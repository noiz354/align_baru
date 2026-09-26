/**
 * Rate limiting port.
 *
 * Requirements:
 * - FR-SAFE-001 (server-side limits)
 * - FR-ABUSE-001
 * - FR-SAFE-002 (cooldown)
 *
 * ADR:
 * - ADR-003 (realtime transport)
 * - ADR-012 (ban enforcement)
 *
 * See:
 * - ABUSE_PREVENTION.md §2, §2.3
 * - SECURITY.md §9
 *
 * PORT ONLY. No rate limiting is implemented in this phase.
 *
 * CRITICAL (ADR-012 MR-2): a shared-IP signal can only ever trigger a rate
 * limit or a cooldown. It can NEVER trigger a standalone ban.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}

/**
 * The complete rate-limit schedule.
 *
 * See ABUSE_PREVENTION.md §2. All limits are server-side and per IDENTITY,
 * not per connection (T-24).
 */
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

/**
 * The progressive cooldown ladder.
 *
 * See ABUSE_PREVENTION.md §2.3. Cooldowns are shown honestly to the user and
 * are never disguised as network errors (DESIGN.md §12).
 */
export const COOLDOWN_LADDER = [
  { triggersWithin60s: 3, durationMs: 30_000 },
  { triggersWithin60s: 5, durationMs: 300_000 },
  { escalated: true, durationMs: 60_000 },
  { escalated: true, durationMs: 600_000 },
  { escalated: true, durationMs: 3_600_000 },
] as const;

/**
 * Rate limiter port.
 *
 * T-ABUSE-061
 *
 * Throws until implemented. When implemented it must:
 * - key limits on the participant identity, never the connection
 * - record a `SafetyEvent` of type `rate-limit-triggered` on every trigger
 * - never be weakened for performance (PERFORMANCE.md §8)
 */
export interface RateLimiterPort {
  check(
    identityId: string,
    limitName: keyof typeof RATE_LIMITS,
  ): Promise<RateLimitResult>;
  applyCooldown(identityId: string, durationMs: number): Promise<void>;
  cooldownRemaining(identityId: string): Promise<number>;
}

export const createNotImplementedRateLimiterPort = (): RateLimiterPort => ({
  async check(
    _identityId: string,
    _limitName: keyof typeof RATE_LIMITS,
  ): Promise<RateLimitResult> {
    throw new Error('Not implemented: T-ABUSE-061');
  },
  async applyCooldown(_identityId: string, _durationMs: number): Promise<void> {
    throw new Error('Not implemented: T-ABUSE-062');
  },
  async cooldownRemaining(_identityId: string): Promise<number> {
    throw new Error('Not implemented: T-ABUSE-062');
  },
});

/**
 * The IP-derived risk signal.
 *
 * A one-way hash of a COARSE signal. NOT a device fingerprint.
 * Retained 7 days rolling (RETENTION.md Tier 6).
 *
 * Permitted use: rate limiting and cooldowns ONLY.
 */
export interface RiskSignal {
  hash: string;
  /** Coarse only. Never a precise geolocation. */
  regionCode: string | null;
  expiresAt: Date;
}

export interface RiskSignalPort {
  record(identityId: string, rawSignal: string): Promise<RiskSignal>;
  findActive(hash: string): Promise<RiskSignal | null>;
}

export const createNotImplementedRiskSignalPort = (): RiskSignalPort => ({
  async record(_identityId: string, _rawSignal: string): Promise<RiskSignal> {
    throw new Error('Not implemented: T-ABUSE-062');
  },
  async findActive(_hash: string): Promise<RiskSignal | null> {
    throw new Error('Not implemented: T-ABUSE-062');
  },
});
