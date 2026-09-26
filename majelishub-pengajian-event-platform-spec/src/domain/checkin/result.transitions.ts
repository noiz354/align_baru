/**
 * Check-in attempt outcome machine - the result vocabulary is a state machine too.
 *
 * Where this belongs: `src/domain/checkin/` - pure rules, no I/O, no framework, no clock.
 * Specification: STATE_MACHINE.md §3 (authoritative), plus the module documents listed below.
 * Why machines are data: transitions are reviewed as a table, and the test suite walks **every** state
 *   pair (TESTING.md §4.1), so a forbidden transition cannot be introduced by accident.
 * Invariants: guardId values are the guards that must exist before a transition is usable; every
 *   sideEffectId corresponds to a domain event in EVENTS.md. Guard implementations are NOT written in
 *   Phase 0 - they will throw `Not implemented: <task>` (AGENTS.md §5), so no transition can silently
 *   become permissive.
 *  * Product documents: CHECKIN.md §5, docs/security/QR-SECURITY.md.
 * Invariants: only VALID and ALREADY_CHECKED_IN are success-shaped; UNAVAILABLE is always a failure and
 *   must never render as success (docs/architecture/FAILURE-MODEL.md §2).
 * Task ownership: T-CHECKIN-001 (validation), T-CHECKIN-014 (recording), C2.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type CheckInOutcome =
  | "VALID" | "ALREADY_CHECKED_IN" | "INVALID_FORMAT" | "INVALID_TOKEN" | "WRONG_EVENT"
  | "EXPIRED" | "CANCELLED" | "WINDOW_NOT_OPEN" | "WINDOW_CLOSED" | "UNAVAILABLE";

export type CheckInTrigger =
  | "SCAN_QR" | "ENTER_SHORT_CODE" | "SELECT_FROM_NAME_LOOKUP" | "REGISTER_WALK_IN" | "DEPENDENCY_ERROR";

export const checkInOutcomeTransitions: TransitionTable<CheckInOutcome, CheckInTrigger> = {
  machine: "CheckInAttempt",
  states: ["VALID","ALREADY_CHECKED_IN","INVALID_FORMAT","INVALID_TOKEN","WRONG_EVENT","EXPIRED","CANCELLED","WINDOW_NOT_OPEN","WINDOW_CLOSED","UNAVAILABLE"],
  terminalStates: ["VALID","ALREADY_CHECKED_IN","INVALID_FORMAT","INVALID_TOKEN","WRONG_EVENT","EXPIRED","CANCELLED","WINDOW_NOT_OPEN","WINDOW_CLOSED","UNAVAILABLE"],
  transitions: [
    { from: [], to: "VALID", trigger: "SCAN_QR", guardId: "G-CHECKIN-TOKEN-VALID-AND-WINDOW-OPEN", sideEffectIds: ["attendance-insert","ParticipantCheckedIn","audit"] },
    { from: [], to: "ALREADY_CHECKED_IN", trigger: "SCAN_QR", guardId: "G-CHECKIN-ATTENDANCE-EXISTS", sideEffectIds: ["DuplicateCheckInDetected","audit-metric"] },
    { from: [], to: "INVALID_FORMAT", trigger: "SCAN_QR", guardId: "G-CHECKIN-PAYLOAD-GRAMMAR-FAILS", sideEffectIds: [] },
    { from: [], to: "INVALID_TOKEN", trigger: "SCAN_QR", guardId: "G-CHECKIN-HASH-NOT-FOUND", sideEffectIds: ["audit-rate-limited"] },
    { from: [], to: "WRONG_EVENT", trigger: "SCAN_QR", guardId: "G-CHECKIN-TOKEN-OTHER-EVENT", sideEffectIds: ["audit"] },
    { from: [], to: "EXPIRED", trigger: "SCAN_QR", guardId: "G-CHECKIN-TOKEN-OR-WINDOW-EXPIRED", sideEffectIds: ["audit"] },
    { from: [], to: "CANCELLED", trigger: "SCAN_QR", guardId: "G-CHECKIN-REGISTRATION-OR-EVENT-CANCELLED", sideEffectIds: ["audit"] },
    { from: [], to: "WINDOW_NOT_OPEN", trigger: "SCAN_QR", guardId: "G-CHECKIN-WINDOW-NOT-OPEN", sideEffectIds: ["audit"] },
    { from: [], to: "WINDOW_CLOSED", trigger: "SCAN_QR", guardId: "G-CHECKIN-WINDOW-CLOSED", sideEffectIds: ["audit"] },
    { from: [], to: "UNAVAILABLE", trigger: "DEPENDENCY_ERROR", guardId: "G-CHECKIN-DEPENDENCY-FAILED", sideEffectIds: ["alert"] },
    { from: [], to: "VALID", trigger: "REGISTER_WALK_IN", guardId: "G-CHECKIN-WALKIN-TWO-FIELDS-AND-WINDOW", sideEffectIds: ["attendance-insert","WalkInRegistered"] },
    { from: [], to: "VALID", trigger: "ENTER_SHORT_CODE", guardId: "G-CHECKIN-SHORTCODE-VALID", sideEffectIds: ["attendance-insert","ParticipantCheckedIn","audit"] },
    { from: [], to: "VALID", trigger: "SELECT_FROM_NAME_LOOKUP", guardId: "G-CHECKIN-NAME-LOOKUP-CONFIRMED", sideEffectIds: ["attendance-insert","ParticipantCheckedIn","audit"] },
  ],
};
