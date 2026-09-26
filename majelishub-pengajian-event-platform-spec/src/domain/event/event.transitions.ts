/**
 * KajianEvent state machine (DRAFT -> ... -> ARCHIVED / CANCELLED).
 *
 * Where this belongs: `src/domain/event/` - pure rules, no I/O, no framework, no clock.
 * Specification: STATE_MACHINE.md §1 (authoritative), plus the module documents listed below.
 * Why machines are data: transitions are reviewed as a table, and the test suite walks **every** state
 *   pair (TESTING.md §4.1), so a forbidden transition cannot be introduced by accident.
 * Invariants: guardId values are the guards that must exist before a transition is usable; every
 *   sideEffectId corresponds to a domain event in EVENTS.md. Guard implementations are NOT written in
 *   Phase 0 - they will throw `Not implemented: <task>` (AGENTS.md §5), so no transition can silently
 *   become permissive.
 *  * Product documents: docs/product/EVENTS.md, docs/product/PROGRAMS.md.
 * Task ownership: T-EVENT-001 (lifecycle), T-EVENT-002 (publish checklist), T-EVENT-004 (reschedule/cancel).
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type EventState =
  | "DRAFT" | "SCHEDULED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED"
  | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ARCHIVED";

export type EventTrigger =
  | "CREATE" | "PUBLISH" | "OPEN_REGISTRATION" | "CLOSE_REGISTRATION" | "REOPEN_REGISTRATION"
  | "START" | "COMPLETE" | "COMPLETE_EARLY" | "CANCEL" | "ARCHIVE" | "RESCHEDULE";

export const kajianEventTransitions: TransitionTable<EventState, EventTrigger> = {
  machine: "KajianEvent",
  states: ["DRAFT","SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED","IN_PROGRESS","COMPLETED","CANCELLED","ARCHIVED"],
  terminalStates: ["ARCHIVED"],
  transitions: [
    { from: [], to: "DRAFT", trigger: "CREATE", guardId: "G-EVENT-CREATE-SCOPE", sideEffectIds: ["audit"] },
    { from: ["DRAFT"], to: "SCHEDULED", trigger: "PUBLISH", guardId: "G-EVENT-PUBLISH-CHECKLIST", sideEffectIds: ["KajianPublished","search-index"] },
    { from: ["SCHEDULED"], to: "REGISTRATION_OPEN", trigger: "OPEN_REGISTRATION", guardId: "G-REG-MODE-ALLOWS-AND-FUTURE", sideEffectIds: ["RegistrationOpened"] },
    { from: ["REGISTRATION_OPEN"], to: "REGISTRATION_CLOSED", trigger: "CLOSE_REGISTRATION", guardId: "G-REG-CLOSE-REASON", sideEffectIds: ["RegistrationClosed"] },
    { from: ["REGISTRATION_CLOSED"], to: "REGISTRATION_OPEN", trigger: "REOPEN_REGISTRATION", guardId: "G-REG-REOPEN-CAPACITY-AVAILABLE", sideEffectIds: ["RegistrationOpened","audit"] },
    { from: ["SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED"], to: "IN_PROGRESS", trigger: "START", guardId: "G-EVENT-START-REACHED-OR-MANUAL", sideEffectIds: ["KajianStarted"] },
    { from: ["IN_PROGRESS"], to: "COMPLETED", trigger: "COMPLETE", guardId: "G-EVENT-END-PASSED-OR-MANUAL", sideEffectIds: ["KajianCompleted","attendance-finalisation"] },
    { from: ["SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED","IN_PROGRESS"], to: "COMPLETED", trigger: "COMPLETE_EARLY", guardId: "G-EVENT-COMPLETE-EARLY-REASON", sideEffectIds: ["KajianCompleted","audit"] },
    { from: ["DRAFT","SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED","IN_PROGRESS"], to: "CANCELLED", trigger: "CANCEL", guardId: "G-EVENT-CANCEL-REASON-REQUIRED", sideEffectIds: ["KajianCancelled","cancel-registrations","invalidate-tokens","cancel-reminders","audit"] },
    { from: ["COMPLETED"], to: "ARCHIVED", trigger: "ARCHIVE", guardId: "G-EVENT-ARCHIVE-NO-PENDING-MEDIA-JOBS", sideEffectIds: ["KajianArchived","search-index"] },
    // Non-state-change but audited and notified: RESCHEDULE (E13) keeps the same state.
    { from: ["SCHEDULED","REGISTRATION_OPEN","REGISTRATION_CLOSED"], to: "SCHEDULED", trigger: "RESCHEDULE", guardId: "G-EVENT-RESCHEDULE-WRITE", sideEffectIds: ["KajianRescheduled","notify-registrants","audit"] },
    // Explicitly NOT supported (documented refusals): CANCELLED -> anything, ARCHIVED -> anything,
    // COMPLETED -> REGISTRATION_OPEN, IN_PROGRESS -> DRAFT. The absence of these rows is the rule.
  ],
};
