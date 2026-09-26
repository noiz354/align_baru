/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Sales (SALES.md). A sale line stores an immutable unitPriceSnapshot (ADR-0010); totals derive
 * ONLY from snapshots so historical amounts can never change (INV-05, FR-PRICE-004).
 */
import type { Money, CurrencyCode } from "../../shared/money";

export type SaleStatus = "DRAFT" | "COMPLETED" | "VOIDED" | "CORRECTED";

export interface SaleLineSnapshot {
  readonly menuItemId: string;
  readonly quantity: number;
  readonly unitPriceSnapshot: Money;
  readonly pricePolicyId?: string;
  readonly overrideId?: string;
}

export interface SaleTotals {
  readonly linesTotal: Money;
  readonly discountTotal: Money;
  readonly payableTotal: Money;
  readonly currency: CurrencyCode;
}

/** Throws. Task: T-SALE-001. */
export function computeSaleTotalFromSnapshots(
  _lines: readonly SaleLineSnapshot[],
  _discount?: Money
): SaleTotals {
  throw new Error("Not implemented: T-SALE-001");
}

/** Throws. Task: T-SALE-002. Change is integer minor units; "uang pas" is the default shortcut. */
export function computeChangeForCash(_payable: Money, _cashReceived: Money): Money {
  throw new Error("Not implemented: T-SALE-002");
}
