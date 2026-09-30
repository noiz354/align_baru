import { logger } from "@/server/telemetry/logger";

export type MapAnalyticsEvent = "map_viewed" | "map_marker_opened" | "map_filter_changed" | "stale_location_seen";
export type MapFilterKind = "businessDay" | "area";
export type MapMarkerType = "active_shift" | "configured_site";

/** Allowlisted telemetry: no location IDs, coordinates, identities, or marker/source text. */
export function trackOperationsMapEvent(
  eventName: MapAnalyticsEvent,
  properties: {
    requestId: string;
    filters?: readonly MapFilterKind[];
    markerType?: MapMarkerType;
    staleLocationCount?: number;
  },
): void {
  logger.info("operations_map_analytics", {
    eventName,
    page: "operations-map",
    requestId: properties.requestId,
    ...(properties.filters?.length ? { filters: [...properties.filters] } : {}),
    ...(properties.markerType ? { markerType: properties.markerType } : {}),
    ...(properties.staleLocationCount !== undefined ? { staleLocationCount: properties.staleLocationCount } : {}),
  });
}
