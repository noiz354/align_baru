import { z } from "zod";
import { uuidSchema, uuidV7Schema, instantSchema } from "./common";

export const locationGpsSampleSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().min(0).max(100_000),
  capturedAt: instantSchema
}).strict();

export const locationReportRequestSchema = z.object({
  sellingLocationId: uuidSchema,
  trigger: z.enum(["ARRIVED", "CONFIRM_UNCHANGED", "MOVE_SITE", "STEPPED_AWAY", "DEPARTED"]),
  reasonForMove: z.enum([
    "CROWDED", "PERMISSION_ISSUE_REPORTED", "WEATHER", "COMPETITION", "CUSTOMER_FLOW",
    "EQUIPMENT", "PERSONAL", "OTHER"
  ]).optional(),
  note: z.string().max(300).optional(),
  clientReportId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional(),
  gpsSample: locationGpsSampleSchema.optional()
}).strict().superRefine((data, context) => {
  if (data.trigger === "MOVE_SITE" && !data.reasonForMove) {
    context.addIssue({ code: "custom", path: ["reasonForMove"], message: "A reason is required when moving sites" });
  }
});
export type LocationReportRequest = z.infer<typeof locationReportRequestSchema>;

export const locationCaptureEventSchema = z.object({
  event: z.enum(["location_capture_started", "location_permission_denied", "location_save_failed"]),
  reason: z.enum(["denied", "network"]).optional()
}).strict().superRefine((data, context) => {
  if (data.event === "location_permission_denied" && data.reason !== "denied") {
    context.addIssue({ code: "custom", path: ["reason"], message: "Permission-denied events require the denied reason" });
  }
  if (data.event === "location_save_failed" && data.reason !== "network") {
    context.addIssue({ code: "custom", path: ["reason"], message: "Client save-failure events are limited to network failures" });
  }
  if (data.event === "location_capture_started" && data.reason !== undefined) {
    context.addIssue({ code: "custom", path: ["reason"], message: "Capture-started events have no reason property" });
  }
});
export type LocationCaptureEvent = z.infer<typeof locationCaptureEventSchema>;

export const proposedPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});
