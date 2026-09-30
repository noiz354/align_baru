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

export const menuItemCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  categoryId: uuidSchema,
  reason: z.string().trim().min(3).max(300),
}).strict();
export type MenuItemCreateRequest = z.infer<typeof menuItemCreateRequestSchema>;

export const menuItemStatusRequestSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(3).max(300),
}).strict();

export const pricePolicyCreateRequestSchema = z.object({
  menuItemId: uuidSchema,
  scope: z.enum(["ORG", "AREA", "LOCATION"]),
  scopeId: uuidSchema,
  unitPrice: moneySchema.extend({ amountMinor: z.number().int().positive() }).strict(),
  effectiveFrom: instantSchema,
  effectiveTo: instantSchema.optional(),
  reason: z.string().trim().min(3).max(300),
}).strict();
export type PricePolicyCreateRequest = z.infer<typeof pricePolicyCreateRequestSchema>;
