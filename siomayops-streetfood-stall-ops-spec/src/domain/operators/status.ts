/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/** Operators (OPERATORS.md). Status and assignments are domain data; nothing here observes
 *  a person beyond the records they create (no telemetry, no continuous location). */
export type OperatorStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "INACTIVE" | "OFFBOARDED";

export const OPERATOR_TRANSITIONS: Readonly<Record<OperatorStatus, readonly OperatorStatus[]>> = {
  INVITED: ["ACTIVE", "INACTIVE"],
  ACTIVE: ["SUSPENDED", "INACTIVE", "OFFBOARDED"],
  SUSPENDED: ["ACTIVE", "INACTIVE", "OFFBOARDED"],
  INACTIVE: ["ACTIVE", "OFFBOARDED"],
  OFFBOARDED: []
};

export type AssignmentType = "PRIMARY" | "RELIEF" | "TEMPORARY" | "TRAINEE_ACCOMPANIED";

export interface OperatorAssignment {
  readonly assignmentId: string;
  readonly operatorId: string;
  readonly stallId: string;
  readonly areaId: string;
  readonly type: AssignmentType;
  readonly validFrom: Date;
  readonly validTo?: Date;
  readonly createdBy: string;
}

/** Throws. Task: T-OP-002. */
export function assertOperatorTransition(
  _from: OperatorStatus,
  _to: OperatorStatus,
  _reason: string
): void {
  throw new Error("Not implemented: T-OP-002");
}

/** Throws. Task: T-STALL-002. Two PRIMARY assignments for one stall must never overlap. */
export function assertAssignmentHasNoConflict(
  _candidate: OperatorAssignment,
  _existing: readonly OperatorAssignment[]
): void {
  throw new Error("Not implemented: T-STALL-002");
}
