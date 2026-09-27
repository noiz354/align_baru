import { z } from "zod";
import { uuidSchema, uuidV7Schema, instantSchema } from "./common";

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

export const proposedPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
