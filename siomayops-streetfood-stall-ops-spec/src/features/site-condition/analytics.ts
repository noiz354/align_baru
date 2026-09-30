import { logger } from "@/server/telemetry/logger";

export type SiteConditionEventName =
  | "site_condition_viewed"
  | "site_observation_saved"
  | "site_observation_save_failed"
  | "relocation_recommendation_viewed";

export function trackSiteConditionEvent(input: {
  eventName: SiteConditionEventName;
  requestId: string;
  outcome?: "SUCCESS" | "CREATED" | "REPLAYED" | "FAILURE" | "UNAVAILABLE";
  reason?: "VALIDATION" | "FORBIDDEN" | "NO_ACTIVE_SHIFT" | "CONFLICT" | "SERVER";
  cue?: "INSUFFICIENT_DATA" | "REVIEW_SHELTER" | "WET_GROUND_CAUTION" | "NO_RELOCATION_CUE";
}): void {
  logger.info("site_condition_analytics", {
    eventName: input.eventName,
    page: "operator-site-condition",
    requestId: input.requestId,
    ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.cue ? { cue: input.cue } : {}),
  });
}
