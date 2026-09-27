import { z } from "zod";
import { uuidSchema, uuidV7Schema, instantSchema } from "./common";

export const incidentSubmitRequestSchema = z.object({
  shiftId: uuidSchema.optional(),
  stallId: uuidSchema.optional(),
  sellingLocationId: uuidSchema.optional(),
  categoryId: uuidSchema,
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(5).max(2000),
  peopleInvolvedNote: z.string().max(500).optional(),
  evidenceAssetIds: z.array(uuidSchema).optional(),
  clientIncidentId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional()
});
export type IncidentSubmitRequest = z.infer<typeof incidentSubmitRequestSchema>;
