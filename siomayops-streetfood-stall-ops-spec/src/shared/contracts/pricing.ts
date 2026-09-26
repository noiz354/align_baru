/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §4 — price acknowledgement (digest-bound). Requirement: FR-PRICE-010, task T-PRICE-003. */
export const priceAcknowledgementRequestSchema = z.object({
  priceSetDigest: z.string().min(8),
  acknowledgedAt: instantSchema,
  clientShiftId: uuidV7Schema
});

/** Price policy shape as consumed by resolution. Requirement: FR-PRICE-001..006, task T-PRICE-002. */
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
