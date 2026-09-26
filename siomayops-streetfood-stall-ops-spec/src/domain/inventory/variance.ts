/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Inventory (INVENTORY.md, ADR-0030). Movements are append-only; positions are DERIVED.
 * Every difference is explainable by a reason, including the explicit UNKNOWN; nothing is
 * ever concluded about a person from variance.
 */
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

/** Throws. Task: T-STOCK-001. */
export function deriveStockPosition(_movements: readonly StockMovement[]): DerivedStockPosition {
  throw new Error("Not implemented: T-STOCK-001");
}

/** Throws. Task: T-STOCK-002. Returns a NEUTRAL difference plus its reason requirement. */
export function computeStockVariance(
  _expectedQuantity: number,
  _countedQuantity: number | null
): { difference: number; reasonRequired: boolean; uncounted: boolean } {
  throw new Error("Not implemented: T-STOCK-002");
}
