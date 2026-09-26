/**
 * TranscriptionJob machine (NOT_REQUESTED -> QUEUED -> PROCESSING -> DRAFT -> REVIEW_REQUIRED ->
 * APPROVED -> PUBLISHED, with FAILED / UNPUBLISHED branches).
 *
 * Where this belongs: `src/domain/transcript/`.
 * Specification: STATE_MACHINE.md §6, TRANSCRIPTION.md, ADR-0011 (provider port), ADR-0012 (human gate).
 * Invariants: DRAFT is the machine draft (revision #1) and is never mutated; APPROVED binds a revision
 *   number; PUBLISHED requires approved_revision_id = published_revision_id and an approver; an empty or
 *   malformed provider result is FAILED, never a normal-looking draft.
 * Task ownership: T-TRANSCRIPT-001/002 (job + states), T-TRANSCRIPT-012 (gate), C6/C9.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type JobState = "NOT_REQUESTED" | "QUEUED" | "PROCESSING" | "DRAFT" | "REVIEW_REQUIRED" | "APPROVED" | "PUBLISHED" | "UNPUBLISHED" | "FAILED";
export type JobTrigger = "REQUEST" | "SUBMIT" | "COMPLETE_OK" | "COMPLETE_FAIL" | "QUEUE_FOR_REVIEW" | "SAVE_REVISION" | "APPROVE" | "PUBLISH" | "UNPUBLISH" | "RETRY";

export const transcriptionJobTransitions: TransitionTable<JobState, JobTrigger> = {
  machine: "TranscriptionJob",
  states: ["NOT_REQUESTED","QUEUED","PROCESSING","DRAFT","REVIEW_REQUIRED","APPROVED","PUBLISHED","UNPUBLISHED","FAILED"],
  terminalStates: [],
  transitions: [
    { from: ["NOT_REQUESTED","UNPUBLISHED"], to: "QUEUED", trigger: "REQUEST", guardId: "G-TRANSCRIPT-POLICY-AND-ASSET-READY", sideEffectIds: ["TranscriptionRequested"] },
    { from: ["QUEUED"], to: "PROCESSING", trigger: "SUBMIT", guardId: "G-TRANSCRIPT-PROVIDER-ACCEPTED", sideEffectIds: ["TranscriptionStarted"] },
    { from: ["PROCESSING"], to: "DRAFT", trigger: "COMPLETE_OK", guardId: "G-TRANSCRIPT-WELL-FORMED-AND-SEGMENTED", sideEffectIds: ["TranscriptionCompleted","TranscriptDrafted"] },
    { from: ["PROCESSING"], to: "FAILED", trigger: "COMPLETE_FAIL", guardId: "G-TRANSCRIPT-ERROR-OR-EMPTY", sideEffectIds: ["TranscriptionFailed"] },
    { from: ["DRAFT"], to: "REVIEW_REQUIRED", trigger: "QUEUE_FOR_REVIEW", guardId: "G-TRANSCRIPT-AT-LEAST-ONE-SEGMENT", sideEffectIds: ["review-queue-notify"] },
    { from: ["REVIEW_REQUIRED"], to: "REVIEW_REQUIRED", trigger: "SAVE_REVISION", guardId: "G-TRANSCRIPT-VERSION-MATCH", sideEffectIds: ["TranscriptRevisionSaved"] },
    { from: ["REVIEW_REQUIRED"], to: "APPROVED", trigger: "APPROVE", guardId: "G-TRANSCRIPT-APPROVE-PERMISSION-AND-FLAGS-RESOLVED", sideEffectIds: ["TranscriptApproved","audit"] },
    { from: ["APPROVED"], to: "PUBLISHED", trigger: "PUBLISH", guardId: "G-TRANSCRIPT-PUBLISHED-REVISION-EQUALS-APPROVED", sideEffectIds: ["TranscriptPublished","search-index"] },
    { from: ["APPROVED","REVIEW_REQUIRED"], to: "REVIEW_REQUIRED", trigger: "SAVE_REVISION", guardId: "G-TRANSCRIPT-POST-APPROVAL-EDIT", sideEffectIds: ["approval-invalidated","TranscriptRevisionSaved"] },
    { from: ["PUBLISHED"], to: "UNPUBLISHED", trigger: "UNPUBLISH", guardId: "G-TRANSCRIPT-WITHDRAW-REASON-REQUIRED", sideEffectIds: ["TranscriptUnpublished","de-index","signing-refused","audit"] },
    { from: ["FAILED"], to: "QUEUED", trigger: "RETRY", guardId: "G-TRANSCRIPT-ATTEMPTS-REMAIN", sideEffectIds: ["new-job-row"] },
  ],
};
