/**
 * Validate a scanned or typed check-in token and produce one outcome.
 *
 * Where this belongs: application layer (features/checkin), called by:
 *   - the entrance console (client → POST /api/v1/checkin/validate)
 *   - the manual short-code and name-lookup paths
 * Why it is not implemented yet: it is the core of roadmap slice VS-4 (T-CHECKIN-001).
 *
 * Invariants: a token never yields two attendance records (C2); ALREADY_CHECKED_IN is success-shaped;
 *   validation is side-effect free (no attendance write here); the response never echoes the token.
 * Security: hashing + constant-time comparison (SECURITY.md §6); per-device/per-event rate limits;
 *   no distinguishable timing between "unknown" and "wrong event" beyond the product's own message.
 * Privacy: returns only what the console needs (display name, group size, masked identifier) and never
 *   the contact method (T-ATTEND-006).
 * Concurrency: C2 is enforced at the recording step; this function must remain pure with respect to
 *   attendance so retries are safe.
 * Failure cases: INVALID_FORMAT (client-side, no server traffic) · INVALID_TOKEN · WRONG_EVENT ·
 *   EXPIRED · REVOKED · CANCELLED · WINDOW_NOT_OPEN · WINDOW_CLOSED · UNAVAILABLE (never success).
 */
import type { CheckInAttempt, CheckInResult } from "@/shared/contracts/checkin";

export interface ValidateCheckInDeps {
  /** Tenant scope derived from the bound console session - never from the request body (ADR-0017). */
  readonly scope: import("@/shared/contracts/scope").TenantScope;
}

/**
 * @throws Error("Not implemented: T-CHECKIN-001")
 */
export async function validateCheckInToken(attempt: CheckInAttempt, deps: ValidateCheckInDeps): Promise<CheckInResult> {
  throw new Error("Not implemented: T-CHECKIN-001");
}
