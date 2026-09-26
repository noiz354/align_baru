/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** API.md §2/§3 — location reports and moves. Requirements: FR-LOCATION-004/005/006/007, INV-07. */
export const locationReportRequestSchema = z.object({
  sellingLocationId: uuidSchema,
  trigger: z.enum(["ARRIVED", "CONFIRM_UNCHANGED", "MOVE_SITE", "STEPPED_AWAY", "DEPARTED"]),
  reasonForMove: z.enum([
    "CROWDED", "PERMISSION_ISSUE_REPORTED", "WEATHER", "COMPETITION", "CUSTOMER_FLOW",
    "EQUIPMENT", "PERSONAL", "OTHER"
  ]).optional(),
  note: z.string().max(300).optional(),
  clientReportId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional()
});
export type LocationReportRequest = z.infer<typeof locationReportRequestSchema>;

/** Optional one-shot prefill only: the value is never stored as a trail (ADR-0007). */
export const proposedPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
