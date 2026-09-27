import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema, businessDaySchema } from "./common";

export const startShiftRequestSchema = z.object({
  operatorId: uuidSchema,
  stallId: uuidSchema,
  sellingLocationId: uuidSchema,
  openingCash: moneySchema.optional(),
  startingStock: z.array(z.object({ stockItemId: uuidSchema, quantity: z.number().int() })).default([]),
  priceSetAcknowledgedAt: instantSchema.optional(),
  plannedShiftId: uuidSchema.optional(),
  clientShiftId: uuidV7Schema,
  notes: z.string().max(500).optional()
});
export type StartShiftRequest = z.infer<typeof startShiftRequestSchema>;

export const startShiftResponseSchema = z.object({
  shiftId: uuidSchema,
  businessDay: businessDaySchema,
  status: z.literal("OPEN"),
  startedAt: instantSchema,
  stockSnapshotId: uuidSchema,
  locationReportId: uuidSchema,
  version: z.number().int()
});
export type StartShiftResponse = z.infer<typeof startShiftResponseSchema>;

export const submitClosingRequestSchema = z.object({
  countedCash: moneySchema,
  varianceReason: z.string().max(200).optional(),
  varianceNote: z.string().max(500).optional(),
  stockCounts: z.array(z.object({
    stockItemId: uuidSchema,
    countedQuantity: z.number().int().nullable(),
    reason: z.string().max(200).optional(),
    notCounted: z.boolean().optional()
  })).default([]),
  clientClosingId: uuidV7Schema,
  departureLocationReportId: uuidSchema.optional()
});
export type SubmitClosingRequest = z.infer<typeof submitClosingRequestSchema>;
