/**
 * Check-in contracts - the outcome vocabulary is part of the specification.
 * Specification: CHECKIN.md §5, STATE_MACHINE.md §3, docs/security/QR-SECURITY.md.
 * Invariants:
 *   1. Exactly one result per attempt; only VALID and ALREADY_CHECKED_IN are success-shaped.
 *   2. A timeout or dependency failure is UNAVAILABLE - never a success (docs/architecture/FAILURE-MODEL.md).
 *   3. The response never echoes the submitted token; the console never displays contact details.
 *   4. Manual/short-code attempts carry a reason when they override a missing token.
 */
export type CheckInResultKind =
  | "VALID" | "ALREADY_CHECKED_IN" | "INVALID_FORMAT" | "INVALID_TOKEN" | "WRONG_EVENT"
  | "EXPIRED" | "CANCELLED" | "WINDOW_NOT_OPEN" | "WINDOW_CLOSED" | "UNAVAILABLE";

export interface CheckInAttempt {
  readonly eventId: string;
  readonly entranceId: string;
  readonly deviceId: string;
  readonly method: "QR" | "SHORT_CODE" | "NAME_LOOKUP";
  readonly token?: string;            // never logged, never persisted in plaintext
  readonly idempotencyKey: string;
}

export interface CheckInResult {
  readonly kind: CheckInResultKind;
  readonly displayName?: string;
  readonly groupSize?: number;
  readonly checkedInAt?: string;      // present for VALID and ALREADY_CHECKED_IN
  readonly message: string;           // Indonesian, plain, actionable
  readonly suggestedAction?: string;
}
