/** PHASE 0 — validated Page 11 input/output shapes. */
import { z } from "zod";

export const TRAFFIC_VIDEO_MAX_BYTES = 10 * 1024 * 1024;
export const TRAFFIC_VIDEO_MAX_DURATION_MS = 10_000;

export const trafficSampleCreateSchema = z.object({
  clientRequestId: z.string().uuid(),
  estimatedCount: z.number().int().min(0).max(500),
  note: z.string().trim().max(240).optional(),
  videoUploadId: z.string().uuid().optional(),
}).strict();

export const trafficVideoUploadMetadataSchema = z.object({
  durationMs: z.coerce.number().int().min(1).max(TRAFFIC_VIDEO_MAX_DURATION_MS),
}).strict();

export const trafficSamplingEventSchema = z.object({
  event: z.enum(["traffic_sample_started", "traffic_analysis_failed"]),
  reason: z.enum(["permission_denied", "unsupported", "cancelled", "network", "validation", "forbidden", "server"]).optional(),
}).strict();

export type TrafficSampleCreate = z.infer<typeof trafficSampleCreateSchema>;
export type TrafficSamplingEvent = z.infer<typeof trafficSamplingEventSchema>;
