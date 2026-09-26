/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §1 — POST /shifts (Start Shift). Requirements: FR-SHIFT-001/003/016. Task: T-SHIFT-001. */
export const startShiftRequestSchema = z.object({
  operatorId: uuidSchema,
  stallId: uuidSchema,
  sellingLocationId: uuidSchema,
  openingCash: moneySchema.optional(),
  startingStock: z.array(z.object({ stockItemId: uuidSchema, quantity: z.number().int() })),
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

/** Closing submission — API.md §13 (Close Shift / Submit Daily Closing). Task: T-CLOSE-001. */
export const submitClosingRequestSchema = z.object({
  countedCash: moneySchema,
  varianceReason: z.string().max(200).optional(),
  varianceNote: z.string().max(500).optional(),
  stockCounts: z.array(z.object({
    stockItemId: uuidSchema,
    countedQuantity: z.number().int(),
    reason: z.string().max(200).optional(),
    notCounted: z.boolean().optional()
  })),
  clientClosingId: uuidV7Schema,
  departureLocationReportId: uuidSchema.optional()
});
export type SubmitClosingRequest = z.infer<typeof submitClosingRequestSchema>;
