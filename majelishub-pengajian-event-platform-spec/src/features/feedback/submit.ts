/**
 * Feedback submission (identified or anonymous).
 *
 * Where this belongs: features/feedback.
 * Specification: FEEDBACK.md, ADR-0016, TASKS.md T-FEEDBACK-001/002/004.
 * Invariants: the anonymity rule is enforced in the domain AND by a database CHECK; one submission per
 *   person per event (window-based); the overall score is required, the rest optional; the form states
 *   honestly that free text may reveal identity.
 * Privacy: no IP, no fingerprint, day-granularity time for anonymous rows; nothing is public.
 * Concurrency: concurrent submissions must not create a link between an anonymous row and a person.
 * Task ownership: T-FEEDBACK-001/002/004.
 */
import type { FeedbackSubmission } from "@/shared/contracts/feedback";

/** @throws Error("Not implemented: T-FEEDBACK-001") */
export async function submitFeedback(input: { submission: FeedbackSubmission; ipHashSaltVersion: number }): Promise<{ receiptId: string }> {
  throw new Error("Not implemented: T-FEEDBACK-001");
}
