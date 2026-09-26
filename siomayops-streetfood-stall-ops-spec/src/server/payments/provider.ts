/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * PaymentProvider port (ADR-0011). Domain and features see only provider-neutral payments.
 * There is NO real provider adapter in this repository and none may be added in Phase 0.
 * Amounts cross this boundary as integer minor units; provider decimal strings (e.g. "10000.00")
 * are converted at the adapter edge and never inside domain code (ADR-0006).
 */
import type { Money } from "../../shared/money";

export type ProviderPaymentState =
  | "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED" | "REFUNDED";

export interface CreateProviderPaymentInput {
  readonly partnerReferenceNo: string;
  readonly amount: Money;
  readonly method: "QRIS_DYNAMIC" | "EWALLET" | "BANK_TRANSFER" | "OTHER_DIGITAL";
  readonly expiresInSeconds?: number;
  readonly idempotencyKey: string;
}

export interface ProviderPayment {
  readonly providerReferenceId: string;
  readonly partnerReferenceNo: string;
  readonly state: ProviderPaymentState;
  readonly amount: Money;
  readonly raw: unknown;
}

export interface ProviderStatusQuery {
  readonly partnerReferenceNo: string;
  readonly providerReferenceId?: string;
}

export interface RefundRequest {
  readonly partnerReferenceNo: string;
  readonly refundReferenceNo: string;
  readonly amount: Money;
  readonly reason: string;
}

export interface PaymentProvider {
  readonly providerId: string;
  createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment>;
  getStatus(query: ProviderStatusQuery): Promise<ProviderPayment>;
  refund(request: RefundRequest): Promise<ProviderPayment>;
}
