/**
 * SpeakerProfile machine (UNCLAIMED -> CLAIMED -> VERIFIED, with DISPUTED).
 *
 * Where this belongs: `src/domain/speaker/`.
 * Specification: STATE_MACHINE.md §9, docs/product/SPEAKERS.md §4, ADR-0014/0024 (no ranking, ever).
 * Invariants: an UNCLAIMED profile is never presented as the speaker's own statements; only a platform
 *   reviewer can VERIFY, with recorded evidence; DISPUTED is visible and blocks statement attribution.
 * Task ownership: T-SPEAKER-002/004.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type SpeakerProfileState = "UNCLAIMED" | "CLAIMED" | "VERIFIED" | "DISPUTED";
export type SpeakerProfileTrigger = "CLAIM" | "VERIFY" | "REJECT" | "DISPUTE" | "RESOLVE";

export const speakerProfileTransitions: TransitionTable<SpeakerProfileState, SpeakerProfileTrigger> = {
  machine: "SpeakerProfile",
  states: ["UNCLAIMED", "CLAIMED", "VERIFIED", "DISPUTED"],
  terminalStates: [],
  transitions: [
    { from: ["UNCLAIMED"], to: "CLAIMED", trigger: "CLAIM", guardId: "G-SPEAKER-CLAIM-AUTHENTICATED", sideEffectIds: ["audit"] },
    { from: ["CLAIMED"], to: "VERIFIED", trigger: "VERIFY", guardId: "G-SPEAKER-VERIFY-PLATFORM-PERMISSION", sideEffectIds: ["audit"] },
    { from: ["CLAIMED"], to: "UNCLAIMED", trigger: "REJECT", guardId: "G-SPEAKER-REJECT-REASON", sideEffectIds: ["audit"] },
    { from: ["UNCLAIMED","CLAIMED","VERIFIED"], to: "DISPUTED", trigger: "DISPUTE", guardId: "G-SPEAKER-DISPUTE-REPORTED", sideEffectIds: ["notice","audit"] },
    { from: ["DISPUTED"], to: "CLAIMED", trigger: "RESOLVE", guardId: "G-SPEAKER-DISPUTE-RESOLVED-WITH-EVIDENCE", sideEffectIds: ["audit"] },
  ],
};
