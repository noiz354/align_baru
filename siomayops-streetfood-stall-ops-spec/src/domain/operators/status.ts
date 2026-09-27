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

export class InvalidOperatorTransitionError extends Error {
  constructor(from: OperatorStatus, to: OperatorStatus) {
    super(`Invalid operator transition ${from} -> ${to}`);
    this.name = "InvalidOperatorTransitionError";
  }
}

export function assertOperatorTransition(
  from: OperatorStatus,
  to: OperatorStatus,
  reason: string
): void {
  if (!reason || reason.trim().length < 3) throw new Error("Reason required for operator status change");
  const allowed = OPERATOR_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidOperatorTransitionError(from, to);
  }
}

export function assertAssignmentHasNoConflict(
  candidate: OperatorAssignment,
  existing: readonly OperatorAssignment[]
): void {
  // Two PRIMARY assignments for one stall must never overlap
  if (candidate.type !== "PRIMARY") return;
  for (const ex of existing) {
    if (ex.stallId !== candidate.stallId) continue;
    if (ex.type !== "PRIMARY") continue;
    if (ex.assignmentId === candidate.assignmentId) continue;
    const candidateFrom = candidate.validFrom.getTime();
    const candidateTo = candidate.validTo ? candidate.validTo.getTime() : Infinity;
    const exFrom = ex.validFrom.getTime();
    const exTo = ex.validTo ? ex.validTo.getTime() : Infinity;
    const overlap = candidateFrom < exTo && exFrom < candidateTo;
    if (overlap) {
      throw new Error(`PRIMARY assignment conflict for stall ${candidate.stallId}`);
    }
  }
}
