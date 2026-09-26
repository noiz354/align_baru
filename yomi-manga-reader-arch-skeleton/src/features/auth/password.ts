/**
 * Password hashing port + policy (Argon2id).
 *
 * Responsibility: the KDF boundary (features define the rules; server/auth
 * implements with the `argon2` package — PLANNED dependency, not installed
 * in the architecture phase).
 *
 * Requirements: NFR-SEC-001, THREAT T-03.
 * Tasks: T-AUTH-002 (implementation + policy), UNIT-AUTH-001/002 (tests).
 *
 * Fixed parameters (single constants module, never per-callsite):
 *   Argon2id, m = 65536 KiB (64 MiB), t = 3, p = 4
 * (research doc: 2026 Node recommendation; params are encoded in the stored
 * hash string, so future upgrades use re-hash-on-login, not migration).
 */

/**
 * Port implemented by server/auth.
 *
 * Invariants:
 * - verify is constant-time (library default; tested, T-AUTH-013).
 * - hashes are never logged (redaction contract, NFR-OBS-006).
 * - parameters are pinned here, not in callers.
 */
export interface PasswordHasher {
  /** Hash with the pinned parameters. */
  hash(password: string): Promise<string>;
  /** Constant-time compare. */
  verify(hash: string, password: string): Promise<boolean>;
  /** True when the stored hash uses older parameters (re-hash signal). */
  needsRehash(hash: string): boolean;
}

/**
 * Password policy (FR-AUTH-001, UNIT-AUTH-002):
 * - length 10..128 (UTF-8 bytes)
 * - not in the common-password denylist (curated list, T-AUTH-002)
 * - does not contain the user's email as a substring
 * Returns typed VALIDATION_PASSWORD_POLICY details (not a boolean blob).
 *
 * Edge cases: 128-char Unicode password (allowed); empty (rejected);
 * email-with-dots normalization happens upstream (citext), policy sees the
 * normalized value.
 *
 * TODO(T-AUTH-002): implementation (pure — unit-testable).
 */
export function validatePasswordPolicy(password: string, email: string): Array<{ path?: string; message: string }> {
  throw new Error('Not implemented: T-AUTH-002 (password policy)');
}
