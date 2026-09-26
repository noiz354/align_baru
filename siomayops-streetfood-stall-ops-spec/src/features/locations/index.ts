/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Location is an explicit, shift-bounded operator report; there is no passive capture path (ADR-0007).
 */
import type { SellingLocationId, AreaId, ShiftId, OperatorId } from "../../shared/types/ids";
import type { LocationOperationalStatus, MoveReason, LocationReport } from "../../domain/location";

export interface SellingPoint {
  readonly sellingLocationId: SellingLocationId;
  readonly areaId: AreaId;
  readonly name: string;
  readonly addressText: string;
  readonly landmark?: string;
  readonly status: LocationOperationalStatus;
  /** Set only by an explicit, attributed HQ verification — never inferred (FR-LOCATION-009). */
  readonly permissionVerifiedBy?: string;
  readonly permissionVerifiedAt?: Date;
}

/** Requirements: FR-LOCATION-001/002. Task: T-LOC-001. */
export async function createSellingPoint(_input: {
  areaId: AreaId; name: string; addressText: string; landmark?: string;
}): Promise<SellingPoint> {
  throw new Error("Not implemented: T-LOC-001");
}

/** Requirements: FR-LOCATION-003/008. Task: T-LOC-002. Status is operational, never a legal claim. */
export async function setLocationStatus(_input: {
  sellingLocationId: SellingLocationId; to: LocationOperationalStatus; reason: string; expiresAt?: Date;
}): Promise<SellingPoint> {
  throw new Error("Not implemented: T-LOC-002");
}

/** Requirements: FR-LOCATION-004/005/007. Task: T-LOC-004. Offline-OK; explicit; shift-bounded. */
export async function reportLocation(_input: {
  shiftId: ShiftId; sellingLocationId: SellingLocationId; trigger: LocationReport["trigger"];
  reasonForMove?: MoveReason; note?: string; clientReportId: string;
}): Promise<{ readonly locationReportId: string }> {
  throw new Error("Not implemented: T-LOC-004");
}

/** Requirements: FR-LOCATION-007. Task: T-LOC-005. A move closes the previous report; history is kept. */
export async function changeLocation(_input: {
  shiftId: ShiftId; toSellingLocationId: SellingLocationId; reasonForMove: MoveReason; note?: string;
}): Promise<readonly LocationReport[]> {
  throw new Error("Not implemented: T-LOC-005");
}

/** Requirements: FR-LOCATION-006. Task: T-LOC-003. Proposal is PENDING_VERIFICATION, shift-scoped. */
export async function proposeSellingPoint(_input: {
  operatorId: OperatorId; shiftId: ShiftId; name: string; addressText: string; note?: string;
}): Promise<{ readonly proposalId: string; readonly verificationState: "PENDING_VERIFICATION" }> {
  throw new Error("Not implemented: T-LOC-003");
}
