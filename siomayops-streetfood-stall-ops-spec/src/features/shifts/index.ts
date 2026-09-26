/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * The shift is the root of cash accountability (DOMAIN.md, SETTLEMENT.md).
 */
import type { ShiftId, StallId, OperatorId, SellingLocationId, ClosingId } from "../../shared/types/ids";
import type { ShiftStatus } from "../../domain/shift";
import type { Money } from "../../shared/money";
import type { BusinessDay } from "../../shared/time";

export interface ShiftSummary {
  readonly shiftId: ShiftId;
  readonly status: ShiftStatus;
  readonly businessDay: BusinessDay;
  readonly stallId: StallId;
  readonly operatorId: OperatorId;
  readonly openingCash?: Money;
  /** derived for display; the stored expected cash is written at closing (T-CLOSE-001) */
  readonly expectedCash: Money;
  readonly version: number;
}

/** Requirements: FR-SHIFT-001/003/007. Task: T-SHIFT-001. Offline-OK via clientShiftId. */
export async function startShift(_input: {
  operatorId: OperatorId; stallId: StallId; sellingLocationId: SellingLocationId;
  openingCash?: Money; startingStock: readonly { stockItemId: string; quantity: number }[];
  clientShiftId: string; plannedShiftId?: string;
}): Promise<ShiftSummary> {
  throw new Error("Not implemented: T-SHIFT-001");
}

/** Requirements: FR-SHIFT-005. Task: T-SHIFT-002. Suspension keeps accountability contiguous. */
export async function suspendShift(_input: { shiftId: ShiftId; reason: string }): Promise<ShiftSummary> {
  throw new Error("Not implemented: T-SHIFT-002");
}

/**
 * Requirements: FR-SHIFT-008/009, FR-SETTLE-001, FR-CASH-003/004. Task: T-CLOSE-001.
 * Canonical task id: T-CLOSE-001. The product brief's mandated example stub id `T-SHIFT-031`
 * is an accepted alias for this exact function (documented in TASKS.md, T-CLOSE-001).
 */
export async function prepareShiftClosing(_input: { shiftId: ShiftId }): Promise<{
  readonly expectedCash: Money; readonly cashSalesTotal: Money; readonly cashExpensesTotal: Money;
  readonly unresolvedVerifications: number;
}> {
  throw new Error("Not implemented: T-SHIFT-031");
}

/** Requirements: FR-SHIFT-008/009, FR-SETTLE-002/010. Task: T-CLOSE-003. Offline ⇒ PENDING_SYNC. */
export async function submitShiftClosing(_input: {
  shiftId: ShiftId; countedCash: Money; varianceReason?: string; varianceNote?: string;
  stockCounts: readonly { stockItemId: string; countedQuantity: number | null; reason?: string }[];
  clientClosingId: string;
}): Promise<{ readonly closingId: ClosingId; readonly status: "PENDING_SYNC" | "CLOSING_SUBMITTED" }> {
  throw new Error("Not implemented: T-CLOSE-003");
}

/** Requirements: FR-HANDOVER-001..005, FR-SHIFT-010/011. Task: T-CLOSE-002. Dual confirmation. */
export async function handoverShift(_input: {
  shiftId: ShiftId; incomingOperatorId: OperatorId; carryOverCashCounted: Money;
  openIssuesNote?: string; outgoingConfirmed: boolean; incomingConfirmed: boolean;
}): Promise<{ readonly handoverId: string; readonly status: "COMPLETED" | "CANCELLED" | "DISPUTED" }> {
  throw new Error("Not implemented: T-CLOSE-002");
}
