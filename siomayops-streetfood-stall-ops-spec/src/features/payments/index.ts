/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 * Honesty rules: PAID requires verified evidence or a Finance reconciliation (INV-02);
 * no offline path may produce a successful digital payment (ADR-0033, INV-13).
 */
import type { PaymentId, SaleId } from "../../shared/types/ids";
import type { PaymentStatus, PaymentMethod } from "../../domain/payment";
import type { Money } from "../../shared/money";

export type { PaymentStatus, PaymentMethod };

/** Requirements: FR-PAYMENT-001, FR-CASH-001..003. Task: T-SALE-002. Cash is first-class offline. */
export async function recordCashPayment(_input: {
  saleId: SaleId; amount: Money; cashReceived: Money; clientPaymentId: string;
}): Promise<{ readonly paymentId: PaymentId; readonly status: "PAID"; readonly change: Money }> {
  throw new Error("Not implemented: T-SALE-002");
}

/**
 * Requirements: FR-PAYMENT-002/003/008. Task: T-PAY-002.
 * Requires connectivity: must fail clearly when offline and must NEVER be queued as successful.
 */
export async function createDigitalPayment(_input: {
  saleId: SaleId; method: PaymentMethod; amount: Money; clientPaymentId: string; operatorNote?: string;
}): Promise<{ readonly paymentId: PaymentId; readonly status: PaymentStatus }> {
  throw new Error("Not implemented: T-PAY-002");
}

/** Requirements: FR-PAYMENT-004/005/006, ADR-0012. Task: T-PAY-002. Static QRIS ⇒ waiting state. */
export async function recordStaticQrisPending(_input: {
  saleId: SaleId; amount: Money; operatorNote?: string; clientPaymentId: string;
}): Promise<{
  readonly paymentId: PaymentId;
  readonly status: "PENDING_VERIFICATION";
  readonly displayMessageId: "payments.waitingVerification";
}> {
  throw new Error("Not implemented: T-PAY-002");
}

/** Requirements: FR-PAYMENT-005/009/011. Task: T-PAY-004. The ONLY manual path to PAID. */
export async function recordReconciliation(_input: {
  paymentId: PaymentId; outcome: "MATCHED" | "SHORT" | "OVER" | "MISSING" | "DISPUTED";
  reason: string; evidenceNote: string; evidenceAssetId?: string;
}): Promise<{ readonly paymentId: PaymentId; readonly status: PaymentStatus }> {
  throw new Error("Not implemented: T-PAY-004");
}

/** Requirements: FR-PAYMENT-014/016. Task: T-PAY-004. Refunds are explicit records, never inferred. */
export async function recordRefund(_input: {
  paymentId: PaymentId; amount: Money; reason: string;
}): Promise<{ readonly refundId: string; readonly status: "REFUNDED" | "REFUND_PENDING" }> {
  throw new Error("Not implemented: T-PAY-004");
}
