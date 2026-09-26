/**
 * Registration state machine (REGISTERED / WAITLISTED / CANCELLED).
 *
 * Where this belongs: `src/domain/registration/` - pure rules, no I/O, no framework, no clock.
 * Specification: STATE_MACHINE.md §2 (authoritative), plus the module documents listed below.
 * Why machines are data: transitions are reviewed as a table, and the test suite walks **every** state
 *   pair (TESTING.md §4.1), so a forbidden transition cannot be introduced by accident.
 * Invariants: guardId values are the guards that must exist before a transition is usable; every
 *   sideEffectId corresponds to a domain event in EVENTS.md. Guard implementations are NOT written in
 *   Phase 0 - they will throw `Not implemented: <task>` (AGENTS.md §5), so no transition can silently
 *   become permissive.
 *  * Product documents: REGISTRATION.md.
 * Note: attendance is NOT a registration state (ADR-0025). A checked-in participant stays
 *   `REGISTERED` here; `CHECKED_IN` in older notes is represented by an attendance record.
 * Task ownership: T-REG-001/002/003/006, concurrency cases C1 and C3.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type RegistrationState = "REGISTERED" | "WAITLISTED" | "CANCELLED";
export type RegistrationTrigger =
  | "REGISTER" | "WAITLIST" | "ACCEPT_OFFER" | "PROMOTE_MANUALLY" | "CANCEL"
  | "OFFER_EXPIRED" | "REPLAY_IDEMPOTENT" | "CONTACT_CORRECTED";

export const registrationTransitions: TransitionTable<RegistrationState, RegistrationTrigger> = {
  machine: "Registration",
  states: ["REGISTERED", "WAITLISTED", "CANCELLED"],
  terminalStates: ["CANCELLED"],
  transitions: [
    { from: [], to: "REGISTERED", trigger: "REGISTER", guardId: "G-REG-OPEN-AND-CAPACITY-AND-NO-DUPLICATE", sideEffectIds: ["ParticipantRegistered","issue-token","confirmation-intent"] },
    { from: [], to: "WAITLISTED", trigger: "WAITLIST", guardId: "G-REG-FULL-AND-WAITLIST-ENABLED", sideEffectIds: ["ParticipantWaitlisted","issue-token"] },
    { from: ["WAITLISTED"], to: "REGISTERED", trigger: "ACCEPT_OFFER", guardId: "G-REG-OFFER-VALID-AND-CAPACITY", sideEffectIds: ["WaitlistOfferAccepted","confirmation-intent"] },
    { from: ["WAITLISTED"], to: "REGISTERED", trigger: "PROMOTE_MANUALLY", guardId: "G-REG-PROMOTE-PERMISSION", sideEffectIds: ["WaitlistOfferAccepted","audit"] },
    { from: ["REGISTERED","WAITLISTED"], to: "CANCELLED", trigger: "CANCEL", guardId: "G-REG-CANCEL-NO-ATTENDANCE", sideEffectIds: ["RegistrationCancelled","release-seat","revoke-token","notify"] },
    { from: ["WAITLISTED"], to: "WAITLISTED", trigger: "OFFER_EXPIRED", guardId: "G-REG-OFFER-EXPIRY-PASSED", sideEffectIds: ["WaitlistOfferExpired","offer-next"] },
    { from: ["REGISTERED"], to: "REGISTERED", trigger: "REPLAY_IDEMPOTENT", guardId: "G-REG-IDEMPOTENCY-KEY-MATCH", sideEffectIds: [] },
    { from: ["REGISTERED"], to: "REGISTERED", trigger: "CONTACT_CORRECTED", guardId: "G-REG-CONTACT-CORRECTION-REASON", sideEffectIds: ["audit","notify-new-contact"] },
    // Demotion (REGISTERED -> WAITLISTED) is deliberately absent: it is modelled as CANCEL + re-add,
    // so the audit trail shows two facts rather than a silent reversal.
  ],
};
