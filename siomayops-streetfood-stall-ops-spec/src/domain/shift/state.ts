/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Shift state machine (STATE_MACHINE.md §Operator Shift). DATA ONLY in Phase 0: the transition
 * table is declared so tests and UI can be written against it; the guard function throws.
 * Shift is the root of cash accountability (DOMAIN.md).
 */
export type ShiftStatus =
  | "DRAFT_OFFLINE"
  | "OPEN"
  | "SUSPENDED"
  | "PENDING_SYNC"
  | "CLOSING_SUBMITTED"
  | "CLOSED_ACCEPTED"
  | "CLOSED_RETURNED"
  | "VOID";

export const SHIFT_TRANSITIONS: Readonly<Record<ShiftStatus, readonly ShiftStatus[]>> = {
  DRAFT_OFFLINE: ["OPEN", "VOID"],
  OPEN: ["SUSPENDED", "PENDING_SYNC", "CLOSING_SUBMITTED", "VOID"],
  SUSPENDED: ["OPEN", "CLOSING_SUBMITTED", "VOID"],
  PENDING_SYNC: ["OPEN", "CLOSING_SUBMITTED", "VOID"],
  CLOSING_SUBMITTED: ["CLOSED_ACCEPTED", "CLOSED_RETURNED"],
  CLOSED_ACCEPTED: [],
  CLOSED_RETURNED: ["PENDING_SYNC", "CLOSING_SUBMITTED"],
  VOID: []
};

/** Throws. Task: T-SHIFT-001. */
export function assertShiftTransition(_from: ShiftStatus, _to: ShiftStatus, _reason?: string): void {
  throw new Error("Not implemented: T-SHIFT-001");
}
