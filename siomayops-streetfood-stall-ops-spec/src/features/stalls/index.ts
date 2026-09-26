/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 */
import type { StallId, AreaId, SellingLocationId, OperatorId } from "../../shared/types/ids";
import type { AssignmentType } from "../../domain/operators";

export interface StallRecord {
  readonly stallId: StallId;
  /** configuration data, never a code enum (ADR-0025) */
  readonly stallTypeId: string;
  readonly areaId: AreaId;
  readonly homeLocationId?: SellingLocationId;
  readonly status: "ACTIVE" | "MAINTENANCE" | "RETIRED" | "IN_TRANSIT";
}

/** Requirements: FR-STALL-001/002/007. Task: T-STALL-001. */
export async function registerStall(_input: {
  stallTypeId: string; areaId: AreaId; homeLocationId?: SellingLocationId; notes?: string;
}): Promise<StallRecord> {
  throw new Error("Not implemented: T-STALL-001");
}

/** Requirements: FR-STALL-002/005. Task: T-STALL-001. Supervisor override needs a reason. */
export async function changeStallStatus(_input: {
  stallId: StallId; to: StallRecord["status"]; reason: string; overrideByUserId?: string;
}): Promise<StallRecord> {
  throw new Error("Not implemented: T-STALL-001");
}

/** Requirements: FR-OPERATOR-004/005. Task: T-STALL-002. Overlapping PRIMARY assignments are refused. */
export async function createAssignment(_input: {
  operatorId: OperatorId; stallId: StallId; areaId: AreaId; type: AssignmentType;
  validFrom: Date; validTo?: Date;
}): Promise<{ readonly assignmentId: string }> {
  throw new Error("Not implemented: T-STALL-002");
}
