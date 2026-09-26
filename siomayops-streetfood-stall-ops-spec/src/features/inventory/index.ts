/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Movements are append-only; positions are derived (INV-12). Variance is neutral and always
 * explainable by a reason, including the explicit UNKNOWN (ADR-0030).
 */
import type { StockItemId, StallId, ShiftId } from "../../shared/types/ids";
import type { MovementKind, VarianceReason, DerivedStockPosition } from "../../domain/inventory";

export type { MovementKind, VarianceReason, DerivedStockPosition };

/** Requirements: FR-STOCK-001/002. Task: T-STOCK-001. */
export async function recordMovement(_input: {
  stallId: StallId; shiftId?: ShiftId; stockItemId: StockItemId; kind: MovementKind;
  quantity: number; reason?: VarianceReason; note?: string; occurredAtDevice?: Date; clientMovementId: string;
}): Promise<{ readonly movementId: string }> {
  throw new Error("Not implemented: T-STOCK-001");
}

/** Requirements: FR-STOCK-003/006. Task: T-STOCK-002. */
export async function getStockPosition(_input: {
  stallId: StallId;
}): Promise<readonly DerivedStockPosition[]> {
  throw new Error("Not implemented: T-STOCK-002");
}

/** Requirements: FR-STOCK-006/007/012. Task: T-STOCK-002. UNCOUNTED is explicit, never zero. */
export async function submitStockCount(_input: {
  shiftId: ShiftId; countKind: "OPENING_COUNT" | "MID_COUNT" | "CLOSING_COUNT";
  items: readonly {
    stockItemId: StockItemId; countedQuantity: number | null; reason?: VarianceReason; notCounted?: boolean;
  }[];
  clientReportId: string;
}): Promise<{
  readonly countId: string;
  readonly variances: readonly {
    readonly stockItemId: StockItemId; readonly difference: number; readonly reasonRequired: boolean;
  }[];
}> {
  throw new Error("Not implemented: T-STOCK-002");
}

/** Requirements: FR-STOCK-004/005. Task: T-STOCK-004. */
export async function requestRestock(_input: {
  stallId: StallId; items: readonly { stockItemId: StockItemId; quantity: number }[];
  note?: string; clientRequestId: string;
}): Promise<{ readonly restockRequestId: string; readonly status: "REQUESTED" }> {
  throw new Error("Not implemented: T-STOCK-004");
}

/** Requirements: FR-STOCK-010. Task: T-STOCK-004. Receipt requires the receiving operator's word. */
export async function confirmTransferReceipt(_input: {
  transferId: string; receivingOperatorId: string; confirmed: boolean; note?: string;
}): Promise<{ readonly transferId: string; readonly status: "RECEIVED" | "DISPUTED" | "PENDING" }> {
  throw new Error("Not implemented: T-STOCK-004");
}
