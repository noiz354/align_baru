import { describe, expect, it } from "vitest";
import { deriveSiteConditionCue, SITE_CONDITION_FRESHNESS_MS } from "@/domain/site-condition";
import { unavailableWeatherAdapter } from "@/server/weather/weather-adapter";

const now = new Date("2026-09-30T05:00:00.000Z");

describe("site-condition observation cue", () => {
  it("does not produce a cue without a recent persisted observation", () => {
    expect(deriveSiteConditionCue({ observation: null, now })).toMatchObject({ cue: "INSUFFICIENT_DATA", reason: "NO_OBSERVATION" });
    expect(deriveSiteConditionCue({
      observation: { observedAt: new Date(now.getTime() - SITE_CONDITION_FRESHNESS_MS - 1), groundCondition: "WET", shelterStatus: "NOT_AVAILABLE" },
      now,
    })).toMatchObject({ cue: "INSUFFICIENT_DATA", reason: "OBSERVATION_STALE", observationFresh: false });
  });

  it("returns a human-review cue only for fresh wet ground without shelter", () => {
    expect(deriveSiteConditionCue({
      observation: { observedAt: now, groundCondition: "WET", shelterStatus: "NOT_AVAILABLE" },
      now,
    })).toEqual({ cue: "REVIEW_SHELTER", reason: "WET_GROUND_WITHOUT_SHELTER", observationFresh: true });
    expect(deriveSiteConditionCue({
      observation: { observedAt: now, groundCondition: "WET", shelterStatus: "UNKNOWN" },
      now,
    }).cue).toBe("WET_GROUND_CAUTION");
    expect(deriveSiteConditionCue({
      observation: { observedAt: now, groundCondition: "DRY", shelterStatus: "NOT_AVAILABLE" },
      now,
    }).cue).toBe("NO_RELOCATION_CUE");
  });

  it("uses an explicit no-provider response, never placeholder weather measurements", async () => {
    await expect(unavailableWeatherAdapter.currentForSite({ organizationId: "org", sellingLocationId: "site" })).resolves.toEqual({
      status: "UNAVAILABLE",
      source: null,
      reason: "PROVIDER_NOT_CONFIGURED",
      observedAt: null,
      temperatureCelsius: null,
      precipitationMillimeters: null,
    });
  });
});
