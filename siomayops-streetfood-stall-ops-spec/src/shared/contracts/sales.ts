/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §5/§6 — create sale, complete sale. Requirements: FR-SALE-001..012, task T-SALE-001. */
export const saleLineInputSchema = z.object({
  menuItemId: uuidSchema,
  quantity: z.number().int().positive(),
  overridePriceId: uuidSchema.optional()
});

export const createSaleRequestSchema = z.object({
  shiftId: uuidSchema,
  locationReportId: uuidSchema,
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

/** Void/correction always carries a reason (FR-SALE-005, FR-AUDIT-002). Task: T-SALE-004. */
export const voidSaleRequestSchema = z.object({ reason: z.string().min(3).max(300) });
