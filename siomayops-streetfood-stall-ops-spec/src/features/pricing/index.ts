/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Prices resolve deterministically and never rewrite history (ADR-0008, ADR-0010).
 */
import type { SellingLocationId, AreaId, MenuItemId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";
import type { PriceResolution, OverrideMode } from "../../domain/pricing";

export type { PriceResolution, OverrideMode };

/** Requirements: FR-PRICE-002/003. Task: T-PRICE-001. Reason + approver recorded; no retro edits. */
export async function publishPricePolicy(_input: {
  menuItemId: string; scope: "ORG" | "AREA" | "LOCATION"; scopeId: string;
  unitPrice: Money; effectiveFrom: Date; effectiveTo?: Date; reason: string; approvedByUserId?: string;
}): Promise<{ readonly pricePolicyId: string }> {
  throw new Error("Not implemented: T-PRICE-001");
}

/** Requirements: FR-PRICE-001/005/006. Task: T-PRICE-002. Ambiguity fails loudly; no implicit zero. */
export async function resolvePriceForSale(_input: {
  menuItemId: MenuItemId; areaId?: AreaId; sellingLocationId?: SellingLocationId; at: Date;
}): Promise<PriceResolution> {
  throw new Error("Not implemented: T-PRICE-002");
}

/** Requirements: FR-PRICE-010, FR-MENU-005. Task: T-PRICE-003. Digest-bound acknowledgement. */
export async function preparePriceSetDigest(_input: {
  sellingLocationId: SellingLocationId;
}): Promise<{ readonly digest: string; readonly itemCount: number }> {
  throw new Error("Not implemented: T-PRICE-003");
}

/** Requirements: FR-PRICE-007/008/009, ADR-0009. Task: T-PRICE-004. Bounded, reasoned, audited. */
export async function requestPriceOverride(_input: {
  shiftId: string; menuItemId: string; proposedPrice: Money; reasonCode: string; note?: string;
}): Promise<{ readonly overrideId: string; readonly status: "ALLOWED" | "PENDING_APPROVAL" | "REJECTED" }> {
  throw new Error("Not implemented: T-PRICE-004");
}
