import { logger } from "@/server/telemetry/logger";

export type LocationEventName =
  | "location_page_viewed"
  | "location_capture_started"
  | "location_permission_denied"
  | "location_saved"
  | "location_save_failed";
export type LocationEventReason =
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "network"
  | "validation"
  | "forbidden"
  | "conflict"
  | "server";

/** Page 10 telemetry is enum-only: never send a point, accuracy, report ID, or operator identity. */
export function trackLocationEvent(input: {
  eventName: LocationEventName;
  requestId: string;
  reason?: LocationEventReason;
  gpsSampleIncluded?: boolean;
}): void {
  logger.info("location_update_analytics", {
    eventName: input.eventName,
    page: "operator-location",
    requestId: input.requestId,
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.gpsSampleIncluded !== undefined ? { gpsSampleIncluded: input.gpsSampleIncluded } : {}),
  });
}
