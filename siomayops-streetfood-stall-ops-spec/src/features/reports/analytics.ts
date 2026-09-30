import { logger } from "@/server/telemetry/logger";

export type ReportAnalyticsEvent =
  | "report_viewed"
  | "report_filter_changed"
  | "report_export_requested"
  | "report_export_succeeded"
  | "report_export_failed";

export type ReportFilterKind = "dateRange" | "area" | "outlet";

/** Allowlisted report telemetry: never send row contents, amounts, identities, or raw filters. */
export function trackReportEvent(
  eventName: ReportAnalyticsEvent,
  properties: { requestId: string; status?: string; rangeDays?: number; rowCount?: number; filters?: readonly ReportFilterKind[] },
): void {
  logger.info("report_analytics", {
    eventName,
    page: "reports",
    requestId: properties.requestId,
    ...(properties.status ? { status: properties.status } : {}),
    ...(properties.rangeDays !== undefined ? { rangeDays: properties.rangeDays } : {}),
    ...(properties.rowCount !== undefined ? { rowCount: properties.rowCount } : {}),
    ...(properties.filters?.length ? { filters: [...properties.filters] } : {}),
  });
}
