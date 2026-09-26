/**
 * Attendance window machine (NOT_OPEN -> OPEN -> CLOSED -> FINALIZED).
 *
 * Where this belongs: `src/domain/attendance/` - pure rules, no I/O, no framework, no clock.
 * Specification: STATE_MACHINE.md §10 (authoritative), plus the module documents listed below.
 * Why machines are data: transitions are reviewed as a table, and the test suite walks **every** state
 *   pair (TESTING.md §4.1), so a forbidden transition cannot be introduced by accident.
 * Invariants: guardId values are the guards that must exist before a transition is usable; every
 *   sideEffectId corresponds to a domain event in EVENTS.md. Guard implementations are NOT written in
 *   Phase 0 - they will throw `Not implemented: <task>` (AGENTS.md §5), so no transition can silently
 *   become permissive.
 *  * Product documents: ATTENDANCE.md, ADR-0025, docs/attendance/OFFLINE-EVALUATION.md.
 * Invariants: NO_SHOW is only derived after CLOSED and is never persisted as a record; counts are
 *   derived and reconciled (drift must be zero); corrections are append-only with a reason.
 * Task ownership: T-ATTEND-001/003/004/007.
 */
import type { TransitionTable } from "@/shared/contracts/state-machine";

export type AttendanceWindowState = "NOT_OPEN" | "OPEN" | "CLOSED" | "FINALIZED";
export type AttendanceWindowTrigger = "OPEN" | "OPEN_EARLY" | "CLOSE" | "CLOSE_AUTO" | "FINALIZE";

export const attendanceWindowTransitions: TransitionTable<AttendanceWindowState, AttendanceWindowTrigger> = {
  machine: "AttendanceWindow",
  states: ["NOT_OPEN", "OPEN", "CLOSED", "FINALIZED"],
  terminalStates: ["FINALIZED"],
  transitions: [
    { from: ["NOT_OPEN"], to: "OPEN", trigger: "OPEN", guardId: "G-ATTEND-EVENT-IN-PROGRESS", sideEffectIds: ["enable-checkin"] },
    { from: ["NOT_OPEN"], to: "OPEN", trigger: "OPEN_EARLY", guardId: "G-ATTEND-OPEN-EARLY-PERMISSION", sideEffectIds: ["enable-checkin","audit"] },
    { from: ["OPEN"], to: "CLOSED", trigger: "CLOSE", guardId: "G-ATTEND-CLOSE-PERMISSION", sideEffectIds: ["derive-no-show-window","notify-summary-ready"] },
    { from: ["OPEN"], to: "CLOSED", trigger: "CLOSE_AUTO", guardId: "G-ATTEND-CLOSE-GRACE-PASSED", sideEffectIds: ["derive-no-show-window"] },
    { from: ["CLOSED"], to: "FINALIZED", trigger: "FINALIZE", guardId: "G-ATTEND-SUMMARY-COMPUTED-AND-RECONCILED", sideEffectIds: ["AttendanceSummaryFinalized","notify","alert-resolve"] },
    // Late arrivals after CLOSED require a correction with a reason - not a reopen (history integrity).
  ],
};

/**
 * Attendance derivation helpers (pure).
 * Task ownership: T-ATTEND-002/003/007. Implementations are Phase 0 stubs by design.
 */
export interface AttendanceDerivation {
  deriveNoShow(input: { registered: readonly string[]; attended: readonly string[]; windowClosed: boolean }): readonly string[];
  reconcileCounts(input: { derivedCheckedIn: number; storedRowCount: number }): { drift: number };
}

/** @throws Error("Not implemented: T-ATTEND-003") */
export function attendanceDerivation(): AttendanceDerivation {
  throw new Error("Not implemented: T-ATTEND-003");
}
