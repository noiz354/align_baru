/**
 * Auth domain contracts.
 *
 * Authority: ADR-006, DATA_MODEL.md §1–2/17, API_CONTRACT.md §2.5.
 * Requirements: FR-AUTH-001…010, NFR-SEC-001…005.
 * Tasks: T-AUTH-001…013.
 */
import type { SessionId, UserId } from '../types';

export type UserRole = 'reader' | 'admin';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: UserId;
  email: string; // citext; lowercased
  displayName: string; // may be ''
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * Authentication input (sign-in).
 * Security: `role`/`status` are NOT inputs (THREAT T-07 — forged role fields
 * are ignored; the Zod schema for the public API omits them entirely).
 */
export interface AuthenticationInput {
  email: string;
  password: string;
}

/**
 * Authentication result.
 * Uniformity rule (THREAT T-03): `rejected` does not distinguish unknown
 * email from wrong password; `disabled` is the single documented exception
 * (API_CONTRACT §2.5).
 */
export type AuthenticationResult =
  | { ok: true; session: SessionInfo }
  | { ok: false; reason: 'invalid-credentials' }
  | { ok: false; reason: 'disabled' };

export interface SessionInfo {
  id: SessionId;
  userId: UserId;
  createdAt: string;
  /** Idle expiry (≤ 30 d, sliding) — NFR-SEC-003. */
  expiresAt: string;
  /** Absolute expiry (≤ 90 d) — NFR-SEC-003. */
  absoluteExpiresAt: string;
}

/**
 * The frozen caller identity attached by the route guard (data-flow.md §7).
 * This is the ONLY identity source in features (THREAT T-04).
 */
export interface Caller {
  userId: UserId;
  role: UserRole;
}

/** Optional caller context for public-capable services (catalog detail etc.). */
export type CallerContext = Caller | null;
