import { z } from "zod";

export const mapBusinessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}, "Expected a real business-day date");

export const operationsMapQuerySchema = z.object({
  businessDay: mapBusinessDaySchema.optional(),
  areaId: z.string().trim().min(1).max(160).optional(),
  cursor: z.string().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

export const mapMarkerEventSchema = z.object({
  event: z.literal("map_marker_opened"),
  markerType: z.enum(["active_shift", "configured_site"]),
}).strict();
