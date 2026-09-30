import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOperationsMap, HqDashboardNotFoundError, OperationsMapQueryError } from "@/features/hq/operations-map";
import { memoryStore } from "@/server/db/memory-store";
import type { Scope } from "@/shared/types/scope";

const orgId = "org-map-test";
const areaId = "area-map-test";
const locationId = "location-map-test";
const shiftId = "shift-map-test";
const stallId = "stall-map-test";
const operatorId = "operator-map-test";
const day = "2026-09-29";
const occurredAt = new Date("2026-09-29T12:00:00.000Z");
const scope: Scope = { kind: "org", organizationId: orgId };

function seed() {
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Manggarai", status: "ACTIVE", lat: -6.921, lng: 107.607, createdAt: occurredAt, updatedAt: occurredAt });
  memoryStore.sellingLocations.set("location-map-no-pin", { id: "location-map-no-pin", organizationId: orgId, areaId, name: "Titik Tanpa Koordinat", status: "AVAILABLE", createdAt: occurredAt, updatedAt: occurredAt });
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "MAP-01", type: "CART", status: "ACTIVE", createdAt: occurredAt });
  memoryStore.operators.set(operatorId, { id: operatorId, organizationId: orgId, areaId, name: "Nama Operator Rahasia", phoneE164: "+620000000010", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: occurredAt, updatedAt: occurredAt });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: day, startedAt: occurredAt, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-map-shift", version: 1, createdAt: occurredAt, updatedAt: occurredAt });
  memoryStore.locationReports.set("location-report-map", { id: "location-report-map", organizationId: orgId, shiftId, operatorId, stallId, sellingLocationId: locationId, trigger: "ARRIVED", arrivedAt: occurredAt, clientReportId: "client-map-report", createdAt: occurredAt });
  memoryStore.sales.set("sale-map", { id: "sale-map", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId, businessDay: day, occurredAt, serverAcceptedAt: occurredAt, totalMinor: 42000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-map-sale", version: 1, createdAt: occurredAt });
  memoryStore.incidents.set("incident-map-open", { id: "incident-map-open", organizationId: orgId, shiftId, operatorId, category: "EQUIPMENT", description: "Jangan kirim catatan ini ke map", status: "SUBMITTED", createdAt: occurredAt, updatedAt: occurredAt });
  memoryStore.incidents.set("incident-map-closed", { id: "incident-map-closed", organizationId: orgId, shiftId, operatorId, category: "EQUIPMENT", description: "Closed", status: "CLOSED", createdAt: occurredAt, updatedAt: occurredAt });
}

beforeEach(() => { memoryStore.clear(); seed(); });
afterEach(() => { memoryStore.clear(); });

describe("operations map read model", () => {
  it("projects explicit shift reports to validated selling-point pins with scoped sales and count-only incidents", () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    const result = getOperationsMap({ scope, businessDay: day, now });
    const marker = result.markers.find((item) => item.id === locationId)!;
    expect(result.summary).toMatchObject({ visibleSellingPoints: 2, activeSellingPoints: 1, locationsWithCoordinates: 1, activePointsWithoutCoordinates: 0, staleLocationCount: 1, openIncidentsOnActiveShifts: 1 });
    expect(marker).toMatchObject({
      name: "Manggarai", coordinates: { latitude: -6.921, longitude: 107.607 }, coordinateStatus: "AVAILABLE",
      positionSource: "LOCATION_REPORT", positionAt: occurredAt.toISOString(), freshnessBand: "stale",
      operationalStatus: "ATTENTION", hasActiveShift: true, salesMinor: 42000, transactionCount: 1, openIncidentCount: 1,
    });
    expect(marker).not.toHaveProperty("operatorId");
    expect(marker).not.toHaveProperty("operatorName");
    expect(marker).not.toHaveProperty("activeShiftId");
    expect(JSON.stringify(result)).not.toContain("Nama Operator Rahasia");
    expect(JSON.stringify(result)).not.toContain("Jangan kirim catatan ini");
  });

  it("fails closed for foreign areas/tenants and keeps missing or invalid coordinates explicit", () => {
    const otherArea = "area-map-other";
    memoryStore.sellingLocations.set("location-map-invalid-pin", { id: "location-map-invalid-pin", organizationId: orgId, areaId: otherArea, name: "Pin Invalid", status: "AVAILABLE", lat: 91, lng: 10, createdAt: occurredAt, updatedAt: occurredAt });
    memoryStore.sellingLocations.set("location-map-foreign", { id: "location-map-foreign", organizationId: "foreign-org", areaId, name: "Foreign", status: "ACTIVE", lat: 10, lng: 20, createdAt: occurredAt, updatedAt: occurredAt });
    const areaScope: Scope = { kind: "area", organizationId: orgId, areaId };
    const result = getOperationsMap({ scope: areaScope, businessDay: day });
    expect(result.markers.map((marker) => marker.id)).toEqual([locationId, "location-map-no-pin"]);
    expect(result.markers.find((marker) => marker.id === "location-map-no-pin")?.coordinateStatus).toBe("MISSING");
    expect(() => getOperationsMap({ scope: areaScope, businessDay: day, areaId: otherArea })).toThrow(HqDashboardNotFoundError);
    expect(() => getOperationsMap({ scope, businessDay: day, cursor: "foreign-location-id" })).toThrow(OperationsMapQueryError);
  });

  it("uses deterministic cursor pagination and emits an empty, non-fabricated state", () => {
    for (let index = 0; index < 100; index++) {
      const id = `map-location-${String(index).padStart(3, "0")}`;
      memoryStore.sellingLocations.set(id, { id, organizationId: orgId, areaId, name: `Outlet ${String(index).padStart(3, "0")}`, status: "AVAILABLE", createdAt: occurredAt, updatedAt: occurredAt });
    }
    const first = getOperationsMap({ scope, businessDay: day, limit: 100 });
    expect(first.markers).toHaveLength(100);
    expect(first.pagination.total).toBe(102);
    expect(first.pagination.nextCursor).toBe(first.markers[99]?.id);
    const second = getOperationsMap({ scope, businessDay: day, limit: 100, cursor: first.pagination.nextCursor ?? undefined });
    expect(second.markers).toHaveLength(2);
    expect(second.pagination.nextCursor).toBeNull();

    const empty = getOperationsMap({ scope: { kind: "org", organizationId: "empty-org" }, businessDay: day });
    expect(empty.markers).toEqual([]);
    expect(empty.summary.visibleSellingPoints).toBe(0);
  });
});
