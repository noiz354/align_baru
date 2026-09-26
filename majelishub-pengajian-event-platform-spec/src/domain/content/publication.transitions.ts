/**
 * Publication machine (content-level: spans audio, transcript and materials).
 *
 * Where this belongs: `src/domain/content/`.
 * Specification: STATE_MACHINE.md §7, CONTENT.md, ADR-0012 (nothing machine-authored reaches the public
 *   unreviewed), ADR-0014/0024 (no popularity surfaces anywhere).
 * Invariants: PUBLISHED requires an approval row for the exact revision served; TAKEN_DOWN is terminal
 *   (re-publication is a new decision with a reason); unpublishing is immediate for new requests and
 *   removes the item from search.
 * Task ownership: T-TRANSCRIPT-011/012, T-CONTENT-001/002/006, T-CONTENT-003 (moderation decisions).
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type PublicationState = "INTERNAL" | "READY_TO_PUBLISH" | "PUBLISHED" | "UNPUBLISHED" | "TAKEN_DOWN";
export type PublicationTrigger = "MARK_READY" | "PUBLISH" | "UNPUBLISH" | "TAKE_DOWN" | "REPUBLISH";

export const publicationTransitions: TransitionTable<PublicationState, PublicationTrigger> = {
  machine: "Publication",
  states: ["INTERNAL", "READY_TO_PUBLISH", "PUBLISHED", "UNPUBLISHED", "TAKEN_DOWN"],
  terminalStates: ["TAKEN_DOWN"],
  transitions: [
    { from: ["INTERNAL"], to: "READY_TO_PUBLISH", trigger: "MARK_READY", guardId: "G-PUBLISH-POLICY-ALLOWS-AND-APPROVED", sideEffectIds: [] },
    { from: ["READY_TO_PUBLISH"], to: "PUBLISHED", trigger: "PUBLISH", guardId: "G-PUBLISH-APPROVER-RECORDED", sideEffectIds: ["TranscriptPublished","search-index","notify-speaker"] },
    { from: ["PUBLISHED"], to: "UNPUBLISHED", trigger: "UNPUBLISH", guardId: "G-PUBLISH-REASON-REQUIRED", sideEffectIds: ["TranscriptUnpublished","de-index","signing-refused","audit"] },
    { from: ["UNPUBLISHED"], to: "PUBLISHED", trigger: "REPUBLISH", guardId: "G-PUBLISH-RE-APPROVAL-REQUIRED", sideEffectIds: ["audit","search-index"] },
    { from: ["PUBLISHED","UNPUBLISHED"], to: "TAKEN_DOWN", trigger: "TAKE_DOWN", guardId: "G-PUBLISH-MODERATION-DECISION-PLATFORM-ONLY", sideEffectIds: ["explanation-page","audit"] },
  ],
};
