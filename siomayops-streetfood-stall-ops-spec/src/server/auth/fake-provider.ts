/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Development-only stand-in for AuthPort. It is deliberately NOT functional: there is no code
 * path in Phase 0 that produces a session, and this module must never be importable by production
 * entrypoints (T-FOUND-005 requirement: a fake that cannot be enabled in production).
 */
import type { AuthPort } from "./port";

export const FAKE_AUTH_IS_DISABLED = true;

export function createFakeAuthPortForTests(): AuthPort {
  throw new Error("Not implemented: T-FOUND-005");
}
