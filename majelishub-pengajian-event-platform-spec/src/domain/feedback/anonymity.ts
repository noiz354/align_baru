/**
 * Feedback anonymity rules (pure) - the promise the database also enforces.
 *
 * Where this belongs: `src/domain/feedback/`.
 * Specification: FEEDBACK.md §4, ADR-0016, PRIVACY.md §4.
 * Invariants:
 *   1. Anonymous feedback has NO registration link and NO contact hash - enforced by a database CHECK,
 *      so even a direct INSERT cannot produce an attributable anonymous row (T-FEEDBACK-004).
 *   2. Stored time for anonymous rows is day-granularity (no timing correlation).
 *   3. No IP, device fingerprint or session reference is stored for anonymous submissions.
 *   4. Small-sample suppression (n < 5) applies at the projection layer, so no API can bypass it.
 *   5. Honesty rule: the form states plainly that the free text itself may reveal identity.
 * Task ownership: T-FEEDBACK-004/006.
 */
import type { FeedbackSubmission } from "@/shared/contracts/feedback";

export interface AnonymityGuard {
  assertStorable(submission: FeedbackSubmission): void;
  /** Fields that must be NULL for anonymous rows (checked in the DB as well). */
  readonly nullFieldsForAnonymous: readonly string[];
  toStorageShape(submission: FeedbackSubmission, clockIso: string): { registrationId: string | null; contactHash: string | null; storedAt: string };
}

/** @throws Error("Not implemented: T-FEEDBACK-004") */
export function anonymityGuard(): AnonymityGuard {
  throw new Error("Not implemented: T-FEEDBACK-004");
}
