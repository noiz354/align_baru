/**
 * Auth-specific rate limiting policies (sign-in links, passkey challenges, token attempts).
 *
 * Where this belongs: server/auth; the mechanism is src/server/http/rate-limit.ts (durable store).
 * Specification: SECURITY.md §8, TASKS.md T-SEC-010.
 * Invariants: the in-memory default of the auth library is FORBIDDEN in production
 *   (docs/research/STACK-2026.md §6); limits are shared across replicas; failures are explicit and
 *   never silently allow.
 * Task ownership: T-SEC-010, T-ORG-001.
 */
export const AUTH_POLICIES = {
  signInLinkRequest: { limit: 5, windowSeconds: 900 },
  passkeyChallenge: { limit: 20, windowSeconds: 300 },
  checkInSessionBind: { limit: 10, windowSeconds: 600 },
} as const;

/** @throws Error("Not implemented: T-SEC-010") */
export async function consumeAuthLimit(key: keyof typeof AUTH_POLICIES, value: string): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  throw new Error("Not implemented: T-SEC-010");
}
