/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Price resolution (PRICING.md, ADR-0008). LOCATION > AREA > ORG, newest effectiveFrom wins,
 * ties FAIL LOUDLY (`PRICE_RESOLUTION_AMBIGUOUS`), and a missing price means NOT SELLABLE —
 * never zero, never another location's price (FR-PRICE-005/006).
 */
export type PriceScopeKind = "ORG" | "AREA" | "LOCATION";
export type OverrideMode = "HQ_ONLY" | "SUPERVISOR_APPROVED" | "OPERATOR_ALLOWED";

export interface PricePolicyRow {
  readonly pricePolicyId: string;
  readonly menuItemId: string;
  readonly scope: PriceScopeKind;
  readonly scopeId: string;
  readonly unitPriceMinor: number;
  readonly currency: "IDR";
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
}

export type PriceResolution =
  | { readonly kind: "RESOLVED"; readonly pricePolicyId: string; readonly unitPriceMinor: number; readonly currency: "IDR" }
  | { readonly kind: "NOT_SELLABLE"; readonly menuItemId: string }
  | { readonly kind: "AMBIGUOUS"; readonly candidatePolicyIds: readonly string[] };

/** Throws. Task: T-PRICE-002. Pure function: no clock, no I/O; `at` is passed in. */
export function resolvePrice(
  _menuItemId: string,
  _scope: { organizationId: string; areaId?: string; sellingLocationId?: string },
  _policies: readonly PricePolicyRow[],
  _at: Date
): PriceResolution {
  throw new Error("Not implemented: T-PRICE-002");
}

/** Throws. Task: T-PRICE-004. Bounds, reasons and expiry per ADR-0009. */
export function evaluateOverrideRequest(
  _mode: OverrideMode,
  _basePriceMinor: number,
  _proposedPriceMinor: number,
  _operatorCapabilityFlags: readonly string[]
): { readonly decision: "ALLOW" | "NEEDS_APPROVAL" | "REJECT" ; readonly reasonCode: string } {
  throw new Error("Not implemented: T-PRICE-004");
}
