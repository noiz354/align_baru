import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getMap } from "@/app/api/v1/operations/map/route";
import { POST as postMapEvent } from "@/app/api/v1/operations/map/events/route";
import { logger } from "@/server/telemetry/logger";
import { memoryStore } from "@/server/db/memory-store";

const orgId = "org-map-api";
const areaId = "area-map-api";
const foreignAreaId = "area-map-foreign-api";
const locationId = "location-map-api";
const otherLocationId = "location-map-other-api";
const shiftId = "shift-map-api";
const stallId = "stall-map-api";
const operatorId = "operator-map-api";
const day = "2026-09-29";
const pointTime = new Date(Date.now() - 2 * 60 * 60_000);
const request = (path: string, body?: unknown) => new NextRequest(`http://localhost${path}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function seed() {
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Manggarai", status: "ACTIVE", lat: -6.921, lng: 107.607, createdAt: pointTime, updatedAt: pointTime });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId: foreignAreaId, name: "Tebet", status: "AVAILABLE", lat: -6.23, lng: 106.84, createdAt: pointTime, updatedAt: pointTime });
  memoryStore.sellingLocations.set("foreign-location-map-api", { id: "foreign-location-map-api", organizationId: "foreign-org", areaId, name: "Tidak terlihat", status: "ACTIVE", lat: 10, lng: 20, createdAt: pointTime, updatedAt: pointTime });
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "MAP-API-01", type: "CART", status: "ACTIVE", createdAt: pointTime });
  memoryStore.operators.set(operatorId, { id: operatorId, organizationId: orgId, areaId, name: "Nama Operator Rahasia", phoneE164: "+620000000011", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: pointTime, updatedAt: pointTime });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: day, startedAt: pointTime, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-map-api-shift", version: 1, createdAt: pointTime, updatedAt: pointTime });
  memoryStore.locationReports.set("report-map-api", { id: "report-map-api", organizationId: orgId, shiftId, operatorId, stallId, sellingLocationId: locationId, trigger: "ARRIVED", arrivedAt: pointTime, clientReportId: "client-map-api-report", createdAt: pointTime });
  memoryStore.sales.set("sale-map-api", { id: "sale-map-api", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId, businessDay: day, occurredAt: pointTime, serverAcceptedAt: pointTime, totalMinor: 55000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-map-api-sale", version: 1, createdAt: pointTime });
  memoryStore.incidents.set("incident-map-api", { id: "incident-map-api", organizationId: orgId, shiftId, operatorId, category: "EQUIPMENT", description: "Private incident details", status: "SUBMITTED", createdAt: pointTime, updatedAt: pointTime });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  vi.stubEnv("FAKE_AUTH_AREA_ID", areaId);
  memoryStore.clear();
  seed();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("operations map API", () => {
  it("returns authorized, serializable selling-point data and logs view/filter/staleness without identity or notes", async () => {
    const log = vi.spyOn(logger, "info");
    const response = await getMap(request(`/api/v1/operations/map?businessDay=${day}&areaId=${areaId}`));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(payload.data.markers).toHaveLength(1);
    expect(payload.data.markers[0]).toMatchObject({ id: locationId, coordinates: { latitude: -6.921, longitude: 107.607 }, salesMinor: 55000, freshnessBand: "stale", openIncidentCount: 1 });
    expect(JSON.stringify(payload)).not.toContain("Nama Operator Rahasia");
    expect(JSON.stringify(payload)).not.toContain("Private incident details");
    const events = log.mock.calls.map(([, context]) => (context as { eventName?: string }).eventName);
    expect(events).toContain("map_viewed");
    expect(events).toContain("map_filter_changed");
    expect(events).toContain("stale_location_seen");
  });

  it("rejects unauthenticated/unauthorized users and prevents area/tenant leakage", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await getMap(request("/api/v1/operations/map"))).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    expect((await getMap(request("/api/v1/operations/map"))).status).toBe(403);
    vi.stubEnv("FAKE_AUTH_ROLE", "AREA_SUPERVISOR");
    vi.stubEnv("FAKE_AUTH_AREA_ID", areaId);
    const visible = await getMap(request(`/api/v1/operations/map?areaId=${areaId}&businessDay=${day}`));
    const visiblePayload = await visible.json();
    expect(visible.status).toBe(200);
    expect(visiblePayload.data.markers.map((marker: { id: string }) => marker.id)).toEqual([locationId]);
    expect((await getMap(request(`/api/v1/operations/map?areaId=${foreignAreaId}&businessDay=${day}`))).status).toBe(404);
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    const organizationView = await getMap(request(`/api/v1/operations/map?businessDay=${day}`));
    const organizationPayload = await organizationView.json();
    expect(organizationPayload.data.markers.map((marker: { id: string }) => marker.id)).not.toContain("foreign-location-map-api");
  });

  it("validates calendar dates, strict filters and scope-bound cursors", async () => {
    expect((await getMap(request("/api/v1/operations/map?businessDay=2026-02-30"))).status).toBe(400);
    expect((await getMap(request("/api/v1/operations/map?unknown=value"))).status).toBe(400);
    expect((await getMap(request("/api/v1/operations/map?cursor=foreign-cursor"))).status).toBe(400);
  });

  it("accepts only allowlisted marker telemetry and performs no business-data write", async () => {
    const log = vi.spyOn(logger, "info");
    const before = memoryStore.auditEvents.length;
    const response = await postMapEvent(request("/api/v1/operations/map/events", { event: "map_marker_opened", markerType: "active_shift" }));
    expect(response.status).toBe(202);
    expect(memoryStore.auditEvents).toHaveLength(before);
    const context = log.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(context).toMatchObject({ eventName: "map_marker_opened", page: "operations-map", markerType: "active_shift" });
    expect(JSON.stringify(context)).not.toContain(locationId);
    expect((await postMapEvent(request("/api/v1/operations/map/events", { event: "map_marker_opened", markerType: "configured_site", coordinates: { latitude: 90, longitude: 180 } }))).status).toBe(400);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    expect((await postMapEvent(request("/api/v1/operations/map/events", { event: "map_marker_opened", markerType: "active_shift" }))).status).toBe(403);
  });
});
