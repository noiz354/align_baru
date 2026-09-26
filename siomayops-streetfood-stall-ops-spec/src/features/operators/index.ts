/**
 * PHASE 0 — USE-CASE PORT + STUBS. Authorization, validation and persistence are absent by design.
 * Every exported function throws `Not implemented: T-XXX-XXX` (ADR-0036, AGENTS.md).
 */
import type { OperatorId, AreaId } from "../../shared/types/ids";
import type { OperatorStatus } from "../../domain/operators";

export type { OperatorStatus };

export interface OperatorProfile {
  readonly operatorId: OperatorId;
  readonly fullName: string;
  readonly phoneNumberMasked: string;
  readonly areaId: AreaId;
  readonly status: OperatorStatus;
  readonly capabilityFlags: readonly string[];
}

/** Requirements: FR-OPERATOR-001. Task: T-OP-001. */
export async function registerOperator(_input: {
  fullName: string; phoneNumber: string; areaId: AreaId; createdByUserId: string;
}): Promise<OperatorProfile> {
  throw new Error("Not implemented: T-OP-001");
}

/** Requirements: FR-OPERATOR-006. Task: T-OP-002. Reason mandatory and audited. */
export async function changeOperatorStatus(_input: {
  operatorId: OperatorId; to: OperatorStatus; reason: string;
}): Promise<OperatorProfile> {
  throw new Error("Not implemented: T-OP-002");
}

/** Requirements: FR-OPERATOR-007. Task: T-OP-002. Capability flags are configuration + audit. */
export async function setCapabilityFlags(_input: {
  operatorId: OperatorId; flags: readonly string[]; reason: string;
}): Promise<OperatorProfile> {
  throw new Error("Not implemented: T-OP-002");
}
