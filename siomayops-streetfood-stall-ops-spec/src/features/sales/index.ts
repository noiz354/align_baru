/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Sale lines carry immutable price snapshots; totals derive only from snapshots (ADR-0010, INV-05).
 */
import type { ShiftId, SaleId } from "../../shared/types/ids";
import type { SaleTotals } from "../../domain/sale";
import type { Money } from "../../shared/money";

export interface CreatedSale {
  readonly saleId: SaleId;
  readonly status: "DRAFT" | "COMPLETED";
  readonly totals: SaleTotals;
  readonly idempotentReplay: boolean;
}

/** Requirements: FR-SALE-001/003/006/011, FR-PRICE-004. Task: T-SALE-001. Offline-OK. */
export async function createSale(_input: {
  shiftId: ShiftId; locationReportId: string;
  lines: readonly { menuItemId: string; quantity: number; overrideId?: string }[];
  clientSaleId: string; recordedAtDevice?: Date; idempotencyKey: string;
}): Promise<CreatedSale> {
  throw new Error("Not implemented: T-SALE-001");
}

/** Requirements: FR-SALE-004/005. Task: T-SALE-004. Reason mandatory; a void is never a delete. */
export async function voidSale(_input: { saleId: SaleId; reason: string }): Promise<CreatedSale> {
  throw new Error("Not implemented: T-SALE-004");
}

/** Requirements: FR-SALE-007, FR-CASH-001/002. Task: T-SALE-002. Integer minor units only. */
export async function completeCashSale(_input: {
  saleId: SaleId; cashReceived: Money; clientPaymentId: string;
}): Promise<{ readonly saleId: SaleId; readonly change: Money }> {
  throw new Error("Not implemented: T-SALE-002");
}

/** Requirements: FR-SALE-003, NFR-OFFLINE-003..007. Task: T-SALE-003. Per-record outcome. */
export async function replayOfflineSale(_input: {
  record: unknown; idempotencyKey: string;
}): Promise<{
  readonly outcome: "ACCEPTED" | "DUPLICATE" | "REJECTED" | "DEFERRED";
  readonly saleId?: SaleId;
  readonly reasonCode?: string;
}> {
  throw new Error("Not implemented: T-SALE-003");
}
