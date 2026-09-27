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

export class InvalidShiftTransitionError extends Error {
  constructor(from: ShiftStatus, to: ShiftStatus) {
    super(`Invalid shift transition ${from} -> ${to}`);
    this.name = "InvalidShiftTransitionError";
  }
}

export function assertShiftTransition(from: ShiftStatus, to: ShiftStatus, _reason?: string): void {
  const allowed = SHIFT_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidShiftTransitionError(from, to);
  }
}
