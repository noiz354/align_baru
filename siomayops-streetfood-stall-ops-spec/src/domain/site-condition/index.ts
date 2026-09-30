export const GROUND_CONDITIONS = ["DRY", "WET"] as const;
export type GroundCondition = (typeof GROUND_CONDITIONS)[number];

export const SHELTER_STATUSES = ["AVAILABLE", "NOT_AVAILABLE", "UNKNOWN"] as const;
export type ShelterStatus = (typeof SHELTER_STATUSES)[number];

export type SiteConditionCue =
  | "INSUFFICIENT_DATA"
  | "REVIEW_SHELTER"
  | "WET_GROUND_CAUTION"
  | "NO_RELOCATION_CUE";

export type SiteConditionCueReason =
  | "NO_OBSERVATION"
  | "OBSERVATION_STALE"
  | "WET_GROUND_WITHOUT_SHELTER"
  | "WET_GROUND"
  | "DRY_GROUND";

export const SITE_CONDITION_FRESHNESS_MS = 60 * 60 * 1000;

/**
 * A deliberately transparent, observation-only cue. It is not a weather forecast, numeric score,
 * safety certification, or relocation command. A human retains the decision.
 */
export function deriveSiteConditionCue(input: {
  observation: null | {
    observedAt: Date;
    groundCondition: GroundCondition;
    shelterStatus: ShelterStatus;
  };
  now?: Date;
}): { cue: SiteConditionCue; reason: SiteConditionCueReason; observationFresh: boolean } {
  if (!input.observation) {
    return { cue: "INSUFFICIENT_DATA", reason: "NO_OBSERVATION", observationFresh: false };
  }

  const now = input.now ?? new Date();
  const observedAt = input.observation.observedAt.getTime();
  if (!Number.isFinite(observedAt) || now.getTime() - observedAt > SITE_CONDITION_FRESHNESS_MS) {
    return { cue: "INSUFFICIENT_DATA", reason: "OBSERVATION_STALE", observationFresh: false };
  }

  if (input.observation.groundCondition === "WET" && input.observation.shelterStatus === "NOT_AVAILABLE") {
    return { cue: "REVIEW_SHELTER", reason: "WET_GROUND_WITHOUT_SHELTER", observationFresh: true };
  }
  if (input.observation.groundCondition === "WET") {
    return { cue: "WET_GROUND_CAUTION", reason: "WET_GROUND", observationFresh: true };
  }
  return { cue: "NO_RELOCATION_CUE", reason: "DRY_GROUND", observationFresh: true };
}
