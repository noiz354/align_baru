import { z } from "zod";
import { uuidSchema, uuidV7Schema, instantSchema } from "./common";

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
