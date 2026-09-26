/**
 * Publish / unpublish a reviewed transcript - the gate, implemented once.
 *
 * Where this belongs: features/transcription.
 * Specification: TASKS.md T-TRANSCRIPT-012, docs/transcription/REVIEW-WORKFLOW.md §4/§5, ADR-0012.
 * Invariants: publishing requires `transcript.publish`, an approval row for the SAME revision, the
 *   event policy to allow it, and no unresolved blocking flags unless explicitly acknowledged with a
 *   reason; the database CHECK (`published_at IS NOT NULL => approved_by IS NOT NULL AND
 *   approved_revision_id IS NOT NULL`) is the last line of defence; unpublishing requires a reason and
 *   de-indexes immediately.
 * Security: this is the single most important integrity control in the product (THREAT_MODEL T-13/T-14).
 * Concurrency: C6 (revision conflict) - an approval binds a revision number, so a later edit does not
 *   become public without re-approval.
 * Task ownership: T-TRANSCRIPT-012, T-CONTENT-003.
 */
export interface PublishCheck {
  readonly revisionNumber: number;
  readonly approvedRevisionNumber: number | null;
  readonly blockingFlagsUnresolved: readonly string[];
  readonly acknowledgedFlags: readonly { readonly flagId: string; readonly reason: string }[];
  readonly policyAllowsPublication: boolean;
}

/** @throws Error("Not implemented: T-TRANSCRIPT-012") */
export function evaluatePublishGate(check: PublishCheck): { readonly allowed: boolean; readonly reasons: readonly string[] } {
  throw new Error("Not implemented: T-TRANSCRIPT-012");
}

/** @throws Error("Not implemented: T-TRANSCRIPT-012") */
export async function publishTranscript(input: { transcriptId: string; actor: import("@/shared/contracts/permissions").Actor }): Promise<{ publishedRevisionNumber: number }> {
  throw new Error("Not implemented: T-TRANSCRIPT-012");
}
