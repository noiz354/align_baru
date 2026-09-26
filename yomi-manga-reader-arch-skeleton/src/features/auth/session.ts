/**
 * Session domain rules + repository port (ADR-006).
 *
 * Responsibility: session lifecycle semantics — creation, sliding idle
 * expiry (≤ 30 d, updated at most hourly), absolute expiry (≤ 90 d),
 * revocation, sweep.
 *
 * Requirements: FR-AUTH-006, NFR-SEC-002/003, THREAT T-05.
 * Tasks: T-AUTH-006 (implementation), UNIT-AUTH-003 (expiry math),
 * INT-AUTH-001 (flow legs), T-OBS-005 (sweep job).
 *
 * Security invariants:
 * - tokens: 256-bit random, base64url (cookie value == token).
 * - token lookup: unique index; compare constant-time (T-AUTH-006).
 * - cookies: HttpOnly, Secure (prod), SameSite=Lax, Path=/ (NFR-SEC-002).
 * - rotation on login (fixation nullified, T-05).
 * - revocation is immediate (logout, disable-on-next-request, reset-confirm).
 */
import type { SessionId, UserId } from '../../shared/types';
import type { SessionInfo } from '../../shared/contracts';

export interface SessionRepository {
  /** Create a session (256-bit token). Returns the token (cookie value). */
  create(input: {
    userId: UserId;
    userAgent: string | null;
    ip: string | null;
    idleExpiryDays: number; // 30
    absoluteExpiryDays: number; // 90
  }): Promise<{ id: SessionId; token: string; info: SessionInfo }>;

  /** Resolve a token to its session + user (the guard's only call). */
  getByToken(token: string): Promise<{ session: SessionInfo; userId: UserId } | null>;

  /**
   * Sliding extension of idle expiry — capped at 30 d from CREATION +
   * idle window (never past absolute expiry); updated at most hourly
   * (server-side throttle, not per-request).
   * TODO(T-AUTH-006).
   */
  touchIdle(sessionId: SessionId): Promise<void>;

  /** Revoke one session (logout). Idempotent. */
  revoke(sessionId: SessionId): Promise<void>;

  /** Revoke ALL sessions of a user (reset-confirm, disable). */
  revokeAll(userId: UserId): Promise<void>;

  /** Nightly sweep (T-OBS-005): delete expired; returns count. */
  sweepExpired(): Promise<number>;
}

/**
 * Expiry math (pure — unit-tested, UNIT-AUTH-003):
 * - idle: min(now + 30 d, created + 30 d + …) — the sliding rule is:
 *   expiresAt = min(absoluteExpiry, max(now, lastSeen) + 30 d), applied at
 *   most once per hour per session.
 * - absolute: created + 90 d, never extended.
 *
 * TODO(T-AUTH-006): implement as a pure function (clock injected for tests).
 */
export function computeSessionExpiries(now: Date, created: Date, lastSeen: Date | null): { idleExpiry: Date; absoluteExpiry: Date } {
  throw new Error('Not implemented: T-AUTH-006 (session expiry math)');
}
