import type { Money } from "../../shared/money";
import { money } from "../../shared/money/money";

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

/**
 * Fake provider for development and tests.
 * Deterministic, no external calls.
 */
// MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
class FakePaymentProvider implements PaymentProvider {
  readonly providerId = "FAKE";
  private payments = new Map<string, ProviderPayment>();

  async createPayment(input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    const ref = `FAKE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const payment: ProviderPayment = {
      providerReferenceId: ref,
      partnerReferenceNo: input.partnerReferenceNo,
      state: "PENDING",
      amount: input.amount,
      raw: { fake: true, input },
    };
    this.payments.set(input.partnerReferenceNo, payment);
    return payment;
  }

  async getStatus(query: ProviderStatusQuery): Promise<ProviderPayment> {
    const payment = this.payments.get(query.partnerReferenceNo);
    if (!payment) throw new Error("Provider payment not found");
    return payment;
  }

  async refund(request: RefundRequest): Promise<ProviderPayment> {
    const payment = this.payments.get(request.partnerReferenceNo);
    if (!payment) throw new Error("Payment not found for refund");
    const refunded: ProviderPayment = {
      ...payment,
      state: "REFUNDED",
      raw: { refunded: true, request },
    };
    this.payments.set(request.partnerReferenceNo, refunded);
    return refunded;
  }
}

/**
 * Production stub: remains unconfigured until credentials provided.
 * See task T-PAY-001 for full stub documentation requirements.
 */
class ProductionStubProvider implements PaymentProvider {
  readonly providerId = "PRODUCTION_QRIS";

  /**
   * Creates a payment request using the production QRIS provider.
   *
   * WHY THIS REMAINS A STUB:
   * Production provider credentials and merchant configuration are
   * intentionally unavailable in the repository.
   *
   * REQUIREMENTS:
   * - FR-PAYMENT-014
   * - NFR-SEC-021
   *
   * RELATED ADR:
   * - ADR-0011-payment-provider
   *
   * EXPECTED INPUT:
   * - partnerReferenceNo (saleId)
   * - amount in integer minor units
   * - currency
   * - idempotencyKey
   *
   * EXPECTED OUTPUT:
   * - providerReference
   * - payment status
   * - expiry
   * - provider payload required by the client
   *
   * SECURITY REQUIREMENTS:
   * - credentials must never reach the browser
   * - amount must be derived/verified server-side
   * - callback authenticity must be verified
   * - idempotency must prevent duplicate payment creation
   *
   * FAILURE CASES:
   * - provider timeout
   * - duplicate request
   * - invalid amount
   * - provider rejection
   * - unavailable provider
   *
   * IMPLEMENTATION LOCATION:
   * server/payments/providers/<provider>
   *
   * UNBLOCK CONDITION:
   * Configure the production payment provider credentials and
   * callback secrets described in DEPLOYMENT.md.
   *
   * TRACKING:
   * T-PAYMENT-014 (alias T-PAY-001)
   *
   * IMPORTANT:
   * Do not replace this stub with a fake "success" response.
   */
  async createPayment(_input: CreateProviderPaymentInput): Promise<ProviderPayment> {
    throw new Error(
      "Production payment provider is not configured. See T-PAY-001. Configure credentials per DEPLOYMENT.md."
    );
  }

  async getStatus(_query: ProviderStatusQuery): Promise<ProviderPayment> {
    throw new Error("Production payment provider not configured");
  }

  async refund(_request: RefundRequest): Promise<ProviderPayment> {
    throw new Error("Production payment provider not configured");
  }
}

let providerInstance: PaymentProvider | null = null;

export function createPaymentProvider(): PaymentProvider {
  if (providerInstance) return providerInstance;
  const useFake = process.env.PAYMENT_PROVIDER !== "production";
  if (useFake) {
    providerInstance = new FakePaymentProvider();
  } else {
    providerInstance = new ProductionStubProvider();
  }
  return providerInstance;
}

export function resetPaymentProviderForTests() {
  providerInstance = null;
}
