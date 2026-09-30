/** PHASE 0 — allowlisted analytics only; never send media, result count, text, actor or scope IDs. */
import { logger } from "@/server/telemetry/logger";

export type TrafficSamplingEventName =
  | "traffic_sampling_page_viewed"
  | "traffic_sample_started"
  | "traffic_sample_uploaded"
  | "traffic_analysis_completed"
  | "traffic_analysis_failed";

export const trackTrafficSamplingEvent = (input: {
  eventName: TrafficSamplingEventName;
  requestId: string;
  outcome?: "success" | "failure";
  reason?: "permission_denied" | "unsupported" | "cancelled" | "network" | "validation" | "forbidden" | "server";
  mediaBytes?: number;
  durationMs?: number;
}): void => {
  logger.info("traffic_sampling_analytics", {
    eventName: input.eventName,
    page: "operator-traffic-sampling",
    requestId: input.requestId,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.mediaBytes !== undefined ? { mediaBytes: input.mediaBytes } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  });
};
