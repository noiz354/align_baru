import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOperatorLocationContext } from "@/features/locations";
import { validateLocationGpsSample } from "@/domain/location/report";
import { memoryStore, purgeExpiredGpsSamples, GPS_SAMPLE_RETENTION_MS } from "@/server/db/memory-store";
import { isGpsSampleCaptureEnabled } from "@/features/locations/gps-policy";
import { requestOneShotPosition, LocationCaptureError } from "@/app/operator/location/geolocation";

const orgId = "10000000-0000-7000-0000-000000000001";
const areaId = "20000000-0000-7000-0000-000000000001";
const otherAreaId = "20000000-0000-7000-0000-000000000002";
const operatorId = "30000000-0000-7000-0000-000000000001";
const otherOperatorId = "30000000-0000-7000-0000-000000000002";
const stallId = "40000000-0000-7000-0000-000000000001";
const shiftId = "50000000-0000-7000-0000-000000000001";
const locationId = "60000000-0000-7000-0000-000000000001";
const otherLocationId = "60000000-0000-7000-0000-000000000002";
const foreignLocationId = "60000000-0000-7000-0000-000000000003";
const reportId = "70000000-0000-7000-0000-000000000001";
const now = new Date("2026-09-30T03:00:00.000Z");
const fix = { latitude: -0.91, longitude: 100.36, accuracyMeters: 23, capturedAt: new Date(now.getTime() - 10_000) };

function seed() {
  for (const id of [operatorId, otherOperatorId]) {
    memoryStore.operators.set(id, { id, organizationId: orgId, areaId, name: "Operator", phoneE164: "+620000000000", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now });
  }
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "PDG-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Pasar", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId, name: "Simpang", status: "AVAILABLE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(foreignLocationId, { id: foreignLocationId, organizationId: orgId, areaId: otherAreaId, name: "Area lain", status: "AVAILABLE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-location-test", version: 1, createdAt: now, updatedAt: now });
  memoryStore.locationReports.set(reportId, { id: reportId, organizationId: orgId, shiftId, stallId, operatorId, sellingLocationId: locationId, trigger: "ARRIVED", arrivedAt: now, clientReportId: "70000000-0000-7000-0000-000000000002", createdAt: now, gpsSample: fix });
}

beforeEach(() => { memoryStore.clear(); seed(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("Page 10 GPS domain and read model", () => {
  it("accepts only bounded, fresh, finite GPS samples", () => {
    expect(() => validateLocationGpsSample(fix, now)).not.toThrow();
    expect(() => validateLocationGpsSample({ ...fix, latitude: 91 }, now)).toThrow(/latitude/);
    expect(() => validateLocationGpsSample({ ...fix, accuracyMeters: Number.NaN }, now)).toThrow(/accuracy/);
    expect(() => validateLocationGpsSample({ ...fix, capturedAt: new Date(now.getTime() - 6 * 60_000) }, now)).toThrow(/five minutes/);
    expect(() => validateLocationGpsSample({ ...fix, capturedAt: new Date(now.getTime() + 3 * 60_000) }, now)).toThrow(/five minutes/);
  });

  it("returns the operator's active shift, current point, one self-scoped sample and same-area choices", () => {
    const context = getOperatorLocationContext({ kind: "self", organizationId: orgId, operatorId }, now);
    expect(context.activeShift).toMatchObject({ shiftId, stallCode: "PDG-01" });
    expect(context.currentLocation).toMatchObject({ sellingLocationId: locationId, name: "Pasar", hasOpenReport: true });
    expect(context.gpsSample).toMatchObject({ latitude: fix.latitude, longitude: fix.longitude, accuracyMeters: fix.accuracyMeters });
    expect(context.locationChoices.map((choice) => choice.sellingLocationId)).toEqual([locationId, otherLocationId]);
    expect(JSON.stringify(context)).not.toContain(foreignLocationId);
  });

  it("does not return another operator's shift/sample and rejects a non-self query scope", () => {
    const ownless = getOperatorLocationContext({ kind: "self", organizationId: orgId, operatorId: otherOperatorId }, now);
    expect(ownless.activeShift).toBeNull();
    expect(ownless.gpsSample).toBeNull();
    expect(ownless.locationChoices).toEqual([]);
    expect(() => getOperatorLocationContext({ kind: "org", organizationId: orgId }, now)).toThrow(/Self operator scope/);
  });

  it("purges GPS fields at 14 days while retaining the operational report", () => {
    const staleAt = new Date(now.getTime() - GPS_SAMPLE_RETENTION_MS);
    const report = memoryStore.locationReports.get(reportId)!;
    report.gpsSample = { ...fix, capturedAt: staleAt };
    memoryStore.locationReports.set(reportId, report);
    expect(purgeExpiredGpsSamples(now)).toBe(1);
    const retained = memoryStore.locationReports.get(reportId)!;
    expect(retained.gpsSample).toBeUndefined();
    expect(retained.sellingLocationId).toBe(locationId);
  });

  it("keeps production sample capture disabled unless the approval gate is explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GPS_LOCATION_SAMPLES_ENABLED", "false");
    expect(isGpsSampleCaptureEnabled()).toBe(false);
    vi.stubEnv("GPS_LOCATION_SAMPLES_ENABLED", "true");
    expect(isGpsSampleCaptureEnabled()).toBe(true);
  });

  it("makes exactly one zero-cache browser request when called and classifies permission denial", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback, _failure: PositionErrorCallback, _options?: PositionOptions) => success({
      coords: { latitude: -0.91, longitude: 100.36, accuracy: 23, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition));
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition }, permissions: { query: vi.fn() } });
    const result = await requestOneShotPosition();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toMatchObject({ maximumAge: 0, enableHighAccuracy: true });
    expect(result).toMatchObject({ latitude: -0.91, longitude: 100.36, accuracyMeters: 23 });

    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback, _options?: PositionOptions) => failure({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError) } });
    const denied = requestOneShotPosition();
    await expect(denied).rejects.toBeInstanceOf(LocationCaptureError);
    await expect(denied).rejects.toMatchObject({ reason: "denied" });
  });
});
