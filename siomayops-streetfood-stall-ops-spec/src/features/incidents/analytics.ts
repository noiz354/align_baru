import { logger } from "@/server/telemetry/logger";
import type { IncidentStatus } from "./index";

export type IncidentEventName =
  | "incident_report_started"
  | "incident_submitted"
  | "incident_submit_failed"
  | "incident_reviewed"
  | "incident_review_note_added"
  | "incident_status_changed"
  | "incident_review_failed";
export type IncidentPageName = "operator-incident-report" | "hq-incident-review";

export function trackIncidentEvent(input: {
  eventName: IncidentEventName;
  requestId: string;
  page?: IncidentPageName;
  outcome?: "SUCCESS" | "CREATED" | "REPLAYED" | "UPDATED";
  reason?: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "SERVER";
  fromStatus?: IncidentStatus;
  toStatus?: IncidentStatus;
}): void {
  logger.info("incident_analytics", {
    eventName: input.eventName,
    page: input.page ?? "operator-incident-report",
    requestId: input.requestId,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.fromStatus ? { fromStatus: input.fromStatus } : {}),
    ...(input.toStatus ? { toStatus: input.toStatus } : {}),
  });
}
