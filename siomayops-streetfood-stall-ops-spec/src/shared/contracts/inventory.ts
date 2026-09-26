/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §11/§12 — stock reports and restock requests. Requirements: FR-STOCK-001..012. */
export const stockReportRequestSchema = z.object({
  shiftId: uuidSchema,
  kind: z.enum(["OPENING_COUNT", "MID_COUNT", "CLOSING_COUNT", "WASTE", "DAMAGE", "SAMPLE", "STAFF_MEAL", "ADJUSTMENT", "RETURN", "UNKNOWN"]),
  items: z.array(z.object({
    stockItemId: uuidSchema,
    quantity: z.number().int(),
    notCounted: z.boolean().optional(),
    reason: z.string().max(200).optional(),
    evidenceAssetId: uuidSchema.optional()
  })),
  clientReportId: uuidV7Schema
});

export const restockRequestSchema = z.object({
  stallId: uuidSchema,
  items: z.array(z.object({ stockItemId: uuidSchema, quantity: z.number().int().positive() })),
  neededBy: instantSchema.optional(),
  note: z.string().max(300).optional(),
  clientRequestId: uuidV7Schema
});
