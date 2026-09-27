export type MovementKind =
  | "ISSUE" | "RETURN" | "TRANSFER_IN" | "TRANSFER_OUT" | "WASTE" | "DAMAGE"
  | "SAMPLE" | "STAFF_MEAL" | "ADJUSTMENT" | "UNKNOWN" | "COUNT";

export type VarianceReason =
  | "PORTION_DIFFERENCE" | "SPOILAGE" | "WASTE" | "SAMPLE" | "STAFF_MEAL" | "SPILLAGE"
  | "COUNTING_ERROR" | "UNRECORDED_ISSUE" | "STOCK_OUT_SUBSTITUTION" | "UNKNOWN";

export interface StockMovement {
  readonly movementId: string;
  readonly stallId: string;
  readonly shiftId?: string;
  readonly stockItemId: string;
  readonly kind: MovementKind;
  readonly quantity: number;
  readonly reason?: VarianceReason;
  readonly note?: string;
  readonly recordedBy: string;
  readonly occurredAt: Date;
  readonly clientMovementId: string;
}

export interface DerivedStockPosition {
  readonly stockItemId: string;
  readonly stallId: string;
  readonly quantity: number;
  readonly derivedAt: Date;
}

export function deriveStockPosition(movements: readonly StockMovement[]): DerivedStockPosition {
  if (movements.length === 0) throw new Error("No movements to derive position");
  const stockItemId = movements[0]!.stockItemId;
  const stallId = movements[0]!.stallId;
  let qty = 0;
  for (const m of movements) {
    if (m.stockItemId !== stockItemId) throw new Error("Mixed stock items in derivation");
    // Simple: ISSUE, TRANSFER_IN, RETURN increase; TRANSFER_OUT, WASTE, DAMAGE, SAMPLE, STAFF_MEAL decrease
    switch (m.kind) {
      case "ISSUE":
      case "TRANSFER_IN":
      case "RETURN":
      case "ADJUSTMENT":
        qty += m.quantity;
        break;
      case "TRANSFER_OUT":
      case "WASTE":
      case "DAMAGE":
      case "SAMPLE":
      case "STAFF_MEAL":
      case "UNKNOWN":
        qty -= Math.abs(m.quantity);
        break;
      case "COUNT":
        // COUNT is snapshot, not movement - but if present, set to quantity
        qty = m.quantity;
        break;
    }
  }
  return {
    stockItemId,
    stallId,
    quantity: qty,
    derivedAt: new Date(),
  };
}

export function computeStockVariance(
  expectedQuantity: number,
  countedQuantity: number | null
): { difference: number; reasonRequired: boolean; uncounted: boolean } {
  if (countedQuantity === null) {
    return { difference: 0, reasonRequired: false, uncounted: true };
  }
  const diff = countedQuantity - expectedQuantity;
  const reasonRequired = diff !== 0;
  return { difference: diff, reasonRequired, uncounted: false };
}
