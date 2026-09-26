/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §14 — submit incident. Requirements: FR-INC-001..010 (neutral recording, no auto-judgement). */
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
