/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Payment state machine (STATE_MACHINE.md §Payment, ADR-0011, ADR-0033).
 * PAID is reachable ONLY from verified evidence or an explicit Finance reconciliation (INV-02).
 * The client and the offline queue have no path to PAID (INV-13).
 */
export type PaymentStatus =
  | "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED"
  | "PENDING_VERIFICATION";

export type PaymentMethod =
  | "CASH" | "QRIS_STATIC" | "QRIS_DYNAMIC" | "BANK_TRANSFER" | "EWALLET" | "OTHER_DIGITAL";

/** Data-only table of transitions permitted by the domain (guards throw). */
export const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED", "EXPIRED", "CANCELLED", "PENDING_VERIFICATION"],
  AUTHORIZED: ["PAID", "FAILED", "EXPIRED", "CANCELLED"],
  PENDING_VERIFICATION: ["PAID", "FAILED", "EXPIRED", "CANCELLED"],
  PAID: ["REFUNDED"],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  REFUNDED: []
};

export interface PaymentTransitionContext {
  readonly actorKind: "OPERATOR" | "SYSTEM_PROVIDER_CALLBACK" | "HQ_FINANCE" | "JOB";
  readonly hasVerifiedProviderEvidence: boolean;
  readonly hasReconciliationRecord: boolean;
  readonly isOfflineReplay: boolean;
}

/** Throws. Task: T-PAY-001. */
export function assertPaymentTransition(
  _from: PaymentStatus,
  _to: PaymentStatus,
  _context: PaymentTransitionContext
): void {
  throw new Error("Not implemented: T-PAY-001");
}
