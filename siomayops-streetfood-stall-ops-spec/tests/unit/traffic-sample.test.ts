import { describe, expect, it } from "vitest";
import { deriveTrafficBand, floorToTrafficHour } from "@/domain/traffic-sample";
import { TRAFFIC_VIDEO_MAX_BYTES, TRAFFIC_VIDEO_MAX_DURATION_MS, trafficSampleCreateSchema, trafficVideoUploadMetadataSchema } from "@/shared/contracts/traffic-samples";

describe("traffic sampling domain and contracts", () => {
  it("derives stable bands from manual counts only", () => {
    expect([0, 4, 5, 9, 10, 19, 20, 500].map(deriveTrafficBand)).toEqual([
      "QUIET", "QUIET", "STEADY", "STEADY", "BUSY", "BUSY", "VERY_BUSY", "VERY_BUSY",
    ]);
    expect(() => deriveTrafficBand(-1)).toThrow(/integer/);
    expect(() => deriveTrafficBand(501)).toThrow(/integer/);
    expect(() => deriveTrafficBand(2.5)).toThrow(/integer/);
  });

  it("uses coarse UTC-hour timestamps", () => {
    expect(floorToTrafficHour(new Date("2026-09-30T08:47:22.000Z")).toISOString()).toBe("2026-09-30T08:00:00.000Z");
  });

  it("bounds count, note, video duration, and payload declarations", () => {
    const valid = { clientRequestId: "70000000-0000-7000-0000-000000000001", estimatedCount: 0 };
    expect(trafficSampleCreateSchema.safeParse(valid).success).toBe(true);
    expect(trafficSampleCreateSchema.safeParse({ ...valid, estimatedCount: 501 }).success).toBe(false);
    expect(trafficSampleCreateSchema.safeParse({ ...valid, note: "x".repeat(241) }).success).toBe(false);
    expect(trafficVideoUploadMetadataSchema.safeParse({ durationMs: TRAFFIC_VIDEO_MAX_DURATION_MS }).success).toBe(true);
    expect(trafficVideoUploadMetadataSchema.safeParse({ durationMs: TRAFFIC_VIDEO_MAX_DURATION_MS + 1 }).success).toBe(false);
    expect(TRAFFIC_VIDEO_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});
