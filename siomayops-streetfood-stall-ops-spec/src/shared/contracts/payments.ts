/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/**
 * API.md §7/§8/§9 — cash, digital, provider callback.
 * Requirements: FR-PAYMENT-001..016, FR-CASH-001..006, ADR-0033 (never offline PAID).
 */
export const cashPaymentRequestSchema = z.object({
  saleId: uuidSchema,
  amount: moneySchema,
  cashReceived: moneySchema,
  clientPaymentId: uuidV7Schema
});
export type CashPaymentRequest = z.infer<typeof cashPaymentRequestSchema>;

export const digitalPaymentRequestSchema = z.object({
  saleId: uuidSchema,
  method: z.enum(["QRIS_STATIC", "QRIS_DYNAMIC", "BANK_TRANSFER", "EWALLET", "OTHER_DIGITAL"]),
  amount: moneySchema,
  clientPaymentId: uuidV7Schema,
  operatorNote: z.string().max(300).optional()
});
export type DigitalPaymentRequest = z.infer<typeof digitalPaymentRequestSchema>;

/** Callback payloads are untrusted until verified (signature, reference, amount, replay). */
export const providerCallbackEnvelopeSchema = z.object({
  provider: z.string().min(2),
  rawBody: z.string(),
  headers: z.record(z.string(), z.string())
});

/** HQ Finance reconciliation record — the only manual path to PAID (FR-PAYMENT-009). Task: T-PAY-004. */
export const reconciliationRequestSchema = z.object({
  paymentId: uuidSchema,
  outcome: z.enum(["MATCHED", "SHORT", "OVER", "MISSING", "DISPUTED"]),
  reason: z.string().min(3).max(300),
  evidenceNote: z.string().min(3).max(1000),
  evidenceAssetId: uuidSchema.optional()
});
