import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema } from "./common";

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

export const providerCallbackEnvelopeSchema = z.object({
  provider: z.string().min(2),
  rawBody: z.string(),
  headers: z.record(z.string(), z.string())
});

export const reconciliationRequestSchema = z.object({
  paymentId: uuidSchema,
  outcome: z.enum(["MATCHED", "SHORT", "OVER", "MISSING", "DISPUTED"]),
  reason: z.string().min(3).max(300),
  evidenceNote: z.string().min(3).max(1000),
  evidenceAssetId: uuidSchema.optional()
});
