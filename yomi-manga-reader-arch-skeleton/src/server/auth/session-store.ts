/**
 * server/auth — session store implementation + guard mechanics.
 *
 * Responsibility: SessionRepository implementation (PostgreSQL, via the
 * server/db connection), cookie issuance/reading (flag contract:
 * HttpOnly, Secure in prod, SameSite=Lax, Path=/), the guard
 * implementations (requireUser / requireAdmin — authoritative per-request
 * checks), and the nightly sweep job (T-OBS-005).
 *
 * Requirements: NFR-SEC-002/003, ADR-006, THREAT T-04/T-05.
 * Tasks: T-AUTH-006 (store + cookies), T-AUTH-007 (guards), T-OBS-005
 * (sweep wiring).
 *
 * Rules:
 * - The middleware (src/middleware) does PRESENCE-ONLY checks for
 *   redirect UX; the guards here are the security boundary (ADR-006).
 * - Token compare: constant-time (library default — T-AUTH-013 asserts).
 * - Disabled users fail at the guard (status re-read per request).
 * - Cookies are set/cleared with matching attributes (E2E-AUTH-004
 *   asserts flags).
 *
 * TODO(T-AUTH-006): createSessionStore(db) → SessionRepository impl.
 */
export function createSessionStore(/* db: Db */): unknown {
  throw new Error('Not implemented: T-AUTH-006 (session store)');
}

/**
 * Guard contract (implemented by T-AUTH-007; consumed by route handlers):
 *   requireUser(ctx)   → Caller | throws AUTH_REQUIRED
 *   requireAdmin(ctx)  → Caller | throws AUTH_REQUIRED | AUTH_FORBIDDEN
 * The Caller is the ONLY identity source downstream (THREAT T-04).
 */
export interface Guard {
  requireUser(): Promise<import('../../shared/contracts').Caller>;
  requireAdmin(): Promise<import('../../shared/contracts').Caller>;
}
