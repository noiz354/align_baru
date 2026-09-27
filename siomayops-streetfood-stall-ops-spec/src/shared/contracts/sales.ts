import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema } from "./common";

export const saleLineInputSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z.number().int().positive(),
  overridePriceId: uuidSchema.optional()
});

export const createSaleRequestSchema = z.object({
  shiftId: uuidSchema,
  locationReportId: uuidSchema.optional(),
  lines: z.array(saleLineInputSchema).min(1),
  clientSaleId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional(),
  customerReference: z.string().max(120).optional()
});
export type CreateSaleRequest = z.infer<typeof createSaleRequestSchema>;

export const saleResponseSchema = z.object({
  saleId: uuidSchema,
  status: z.enum(["DRAFT", "COMPLETED", "VOIDED", "CORRECTED"]),
  total: moneySchema,
  lines: z.array(z.object({
    menuItemId: uuidSchema,
    quantity: z.number().int(),
    unitPriceSnapshot: moneySchema,
    pricePolicyId: uuidSchema.optional(),
    lineTotal: moneySchema
  })),
  paymentId: uuidSchema.optional(),
  paymentState: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED", "EXPIRED", "CANCELLED", "REFUNDED", "PENDING_VERIFICATION"]).optional(),
  version: z.number().int()
});
export type SaleResponse = z.infer<typeof saleResponseSchema>;

export const voidSaleRequestSchema = z.object({ reason: z.string().min(3).max(300) });
