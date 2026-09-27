import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema } from "./common";

export const priceAcknowledgementRequestSchema = z.object({
  priceSetDigest: z.string().min(8),
  acknowledgedAt: instantSchema.optional(),
  clientShiftId: uuidV7Schema.optional()
});

export const pricePolicySchema = z.object({
  pricePolicyId: uuidSchema,
  menuItemId: uuidSchema,
  scope: z.enum(["ORG", "AREA", "LOCATION"]),
  scopeId: uuidSchema,
  unitPrice: moneySchema,
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  reason: z.string().min(3).max(300),
  createdBy: uuidSchema,
  approvedBy: uuidSchema.optional()
});
export type PricePolicy = z.infer<typeof pricePolicySchema>;
