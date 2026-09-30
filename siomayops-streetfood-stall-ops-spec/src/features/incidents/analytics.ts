import { logger } from "@/server/telemetry/logger";

export type IncidentEventName = "incident_report_started" | "incident_submitted" | "incident_submit_failed";

export function trackIncidentEvent(input: {
  eventName: IncidentEventName;
  requestId: string;
  outcome?: "SUCCESS" | "CREATED" | "REPLAYED";
  reason?: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "SERVER";
}): void {
  logger.info("incident_analytics", {
    eventName: input.eventName,
    page: "operator-incident-report",
    requestId: input.requestId,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
}
