/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Location reporting (ADR-0007). Location exists ONLY as an explicit, shift-bounded operator
 * report; there is no passive capture path anywhere in the codebase (INV-07).
 */
export type LocationTrigger = "ARRIVED" | "CONFIRM_UNCHANGED" | "MOVE_SITE" | "STEPPED_AWAY" | "DEPARTED";

export type MoveReason =
  | "CROWDED" | "PERMISSION_ISSUE_REPORTED" | "WEATHER" | "COMPETITION" | "CUSTOMER_FLOW"
  | "EQUIPMENT" | "PERSONAL" | "OTHER";

export type LocationOperationalStatus =
  | "AVAILABLE" | "ACTIVE" | "CROWDED" | "TEMPORARILY_UNAVAILABLE" | "RESTRICTED" | "INACTIVE";

export interface LocationReport {
  readonly locationReportId: string;
  readonly shiftId: string;
  readonly stallId: string;
  readonly sellingLocationId: string;
  readonly operatorId: string;
  readonly reportedByOperatorId: string;
  readonly trigger: LocationTrigger;
  readonly reasonForMove?: MoveReason;
  readonly arrivedAt: Date;
  readonly departedAt?: Date;
  readonly note?: string;
  readonly clientReportId: string;
}

/** Throws. Task: T-LOC-004. */
export function validateLocationReport(_report: LocationReport): void {
  throw new Error("Not implemented: T-LOC-004");
}

/** Throws. Task: T-LOC-005. A move never deletes history: the previous report is closed, not edited. */
export function closeLocationReport(_report: LocationReport, _departedAt: Date, _reason: MoveReason): LocationReport {
  throw new Error("Not implemented: T-LOC-005");
}
