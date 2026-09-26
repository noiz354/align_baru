/**
 * Durable rate limiting (shared across replicas) with explicit, documented thresholds.
 *
 * Where this belongs: server/http (transport concern). Policy values live with the feature that needs
 * them (check-in, registration, auth).
 * Specification: SECURITY.md §8, TASKS.md T-PERF-002/T-REG-009/T-SEC-010.
 * Invariants: the store is Postgres (never the library default in-memory store); keys are bucketed by
 *   the correct dimension (device, event, contact-hash, IP-hash) so a mosque's shared Wi-Fi does not
 *   lock out legitimate participants; limits never cause a false success or a silent drop; a limit
 *   rejection is explicit (RATE_LIMITED / SERVER_BUSY) with retry guidance.
 * Privacy: IP is hashed with a rotating salt and never stored raw; abuse counters follow a short
 *   documented retention.
 * Failure cases: store unavailable (choose fail-closed for lookups, keep the manual/paper path usable) ·
 *   burst from one network · coordinated abuse during a popular event.
 * Task ownership: T-SEC-010, T-PERF-002, T-REG-009.
 */
export interface RateLimitPolicy {
  readonly key: string;
  readonly dimension: "DEVICE" | "EVENT" | "CONTACT_HASH" | "IP_HASH" | "USER";
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs?: number;
  readonly remaining?: number;
}

/** @throws Error("Not implemented: T-SEC-010") */
export async function consume(policy: RateLimitPolicy, value: string): Promise<RateLimitDecision> {
  throw new Error("Not implemented: T-SEC-010");
}

/** Documented policies (thresholds tied to the performance budgets P11-P16). */
export const POLICIES: readonly RateLimitPolicy[] = [
  { key: "checkin.validate.device", dimension: "DEVICE", limit: 120, windowSeconds: 60 },
  { key: "checkin.validate.event", dimension: "EVENT", limit: 300, windowSeconds: 60 },
  { key: "checkin.validate.ip", dimension: "IP_HASH", limit: 200, windowSeconds: 60 },
  { key: "registration.create.contact", dimension: "CONTACT_HASH", limit: 3, windowSeconds: 600 },
  { key: "registration.create.ip", dimension: "IP_HASH", limit: 20, windowSeconds: 600 },
  { key: "auth.request.ip", dimension: "IP_HASH", limit: 10, windowSeconds: 600 },
];
