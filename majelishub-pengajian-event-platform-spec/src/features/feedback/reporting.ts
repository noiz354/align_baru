/**
 * Feedback reporting for organizers (and the narrowed speaker view).
 *
 * Where this belongs: features/feedback.
 * Specification: FEEDBACK.md §5/§6, TASKS.md T-FEEDBACK-006, NFR-ETH-001/004.
 * Invariants: small-sample suppression (n < 5) applies at the projection layer and cannot be bypassed;
 *   every rate is shown with its denominator; no speaker comparison, ranking or score exists; abusive
 *   comments can be hidden from reports with a recorded reason (the row is retained per retention rules);
 *   nothing is ever public.
 * Task ownership: T-FEEDBACK-003/006.
 */
export interface OrganizerFeedbackReport {
  readonly responseCount: number;
  readonly denominator: number;
  readonly suppressed: boolean;
  readonly comments: readonly { readonly text: string; readonly anonymous: boolean; readonly hidden?: boolean }[];
  readonly followUpFlags: readonly { readonly id: string; readonly state: "OPEN" | "DONE" }[];
}

/** @throws Error("Not implemented: T-FEEDBACK-003") */
export async function loadFeedbackReport(input: { eventId: string; scope: import("@/shared/contracts/scope").TenantScope; viewerRole: "ORGANIZER" | "SPEAKER" }): Promise<OrganizerFeedbackReport> {
  throw new Error("Not implemented: T-FEEDBACK-003");
}
