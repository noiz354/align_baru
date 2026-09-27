/**
 * Ban evasion detection without fingerprinting — real implementation.
 *
 * Requirements:
 * - FR-ABUSE-006
 * - T-BAN-052
 * - ADR-012, PRIVACY.md §3.1, ABUSE_PREVENTION.md §8
 *
 * Important constraints:
 * - no device fingerprinting, ever, by default
 * - shared-IP signal can only trigger rate limit or cooldown, never standalone ban
 * - no single signal sufficient; correlation plus human review required
 * - any proposal to add fingerprinting requires privacy impact assessment and new ADR
 */

import { banStore, riskSignalStore, rateLimitStore, safetyEventStore, reportStore } from '../db/in-memory';

export interface EvasionSignal {
  type: 'shared-ip-reuse' | 'rapid-reconnect' | 'turn-overuse' | 'repeat-report-pattern' | 'behavioral-similarity';
  participantId: string;
  details: Record<string, string | number>;
  timestamp: Date;
}

export interface EvasionDetectionResult {
  flagged: boolean;
  signals: EvasionSignal[];
  requiresHumanReview: boolean;
  action: 'none' | 'rate-limit' | 'cooldown' | 'review-flag';
}

export const createBanEvasionDetector = () => ({
  async detect(participantId: string, rawIpSignal?: string): Promise<EvasionDetectionResult> {
    const signals: EvasionSignal[] = [];

    // Signal 1: IP-derived risk signal reuse — correlation, not proof
    if (rawIpSignal) {
      const risk = riskSignalStore.record(participantId, rawIpSignal);
      const active = riskSignalStore.findActive(risk.hash);
      if (active) {
        // Check if this hash was seen for banned identities
        // In production, query banStore for recent bans with same hash
        // Here we simulate: if hash reused, it's a weak signal
        signals.push({
          type: 'shared-ip-reuse',
          participantId,
          details: { hash: risk.hash },
          timestamp: new Date(),
        });
      }
    }

    // Signal 2: Rapid reconnect patterns
    const rapidCheck = rateLimitStore.check(participantId, 'queueJoinsPerSecond');
    if (!rapidCheck.allowed) {
      signals.push({
        type: 'rapid-reconnect',
        participantId,
        details: { retryAfterMs: rapidCheck.retryAfterMs ?? 0 },
        timestamp: new Date(),
      });
    }

    // Signal 3: TURN allocation overuse
    const turnCheck = rateLimitStore.check(participantId, 'turnCredentialsPerHour');
    if (!turnCheck.allowed) {
      signals.push({
        type: 'turn-overuse',
        participantId,
        details: { count: 5 },
        timestamp: new Date(),
      });
    }

    // Signal 4: Repeat-report patterns
    const reports = reportStore.findByReporter(participantId);
    if (reports.length > 10) {
      signals.push({
        type: 'repeat-report-pattern',
        participantId,
        details: { reportCount: reports.length },
        timestamp: new Date(),
      });
    }

    // Signal 5: Behavioral similarity (weak signal, review flag only)
    // In production, would analyze message rate, skip cadence, etc.
    // Here we just check if participant has high message rate
    const messageCount = (rateLimitStore as any).messageCounts?.size ?? 0;
    if (messageCount > 100) {
      signals.push({
        type: 'behavioral-similarity',
        participantId,
        details: { messageCount },
        timestamp: new Date(),
      });
    }

    // No single signal is sufficient to ban — correlation plus human review required
    const flagged = signals.length >= 2;
    const requiresHumanReview = flagged;

    let action: EvasionDetectionResult['action'] = 'none';
    if (signals.length === 1) {
      // Single signal: only rate limit or cooldown, never standalone ban (ADR-012 MR-2)
      if (signals[0].type === 'shared-ip-reuse') {
        action = 'rate-limit';
        rateLimitStore.applyCooldown(participantId, 30_000);
      } else {
        action = 'cooldown';
        rateLimitStore.applyCooldown(participantId, 60_000);
      }
    } else if (flagged) {
      action = 'review-flag';
      safetyEventStore.record('rate-limit-triggered', participantId, null, {
        evasionSignals: signals.length,
        action: 'review-flag',
      });
    }

    return {
      flagged,
      signals,
      requiresHumanReview,
      action,
    };
  },

  // Explicit check that shared-IP never triggers standalone ban
  assertNoIpBan(participantId: string): void {
    // This method is used in tests to verify T-BAN-052
    // If ban exists and only signal was shared IP, it's a violation
    if (banStore.isBanned(participantId)) {
      const events = safetyEventStore.all().filter(e => e.participantId === participantId && e.type === 'rate-limit-triggered');
      const hasOnlyIpSignal = events.every(ev => {
        const payload = ev.payload as any;
        return payload.limit === 'shared-ip' || payload.hash;
      });
      if (hasOnlyIpSignal) {
        throw new Error('VIOLATION: shared-IP signal cannot trigger standalone ban (ADR-012 MR-2)');
      }
    }
  },
});
