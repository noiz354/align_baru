import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getReport } from "@/app/api/v1/reports/route";
import { GET as exportReport } from "@/app/api/v1/reports/export/route";
import { memoryStore } from "@/server/db/memory-store";

const orgId = "org-reports-api";
const areaId = "area-reports-api";
const otherAreaId = "area-other-reports-api";
const locationId = "location-reports-api";
const otherLocationId = "location-other-reports-api";
const foreignLocationId = "location-foreign-reports-api";
const stallId = "stall-reports-api";
const shiftId = "shift-reports-api";
const operatorId = "operator-reports-api";
const timestamp = new Date("2026-09-29T12:00:00.000Z");

function request(path: string): NextRequest { return new NextRequest(`http://localhost${path}`); }
function query(values: Record<string, string> = {}) {
  const params = new URLSearchParams({ dateFrom: "2026-09-29", dateTo: "2026-09-30", ...values });
  return `/api/v1/reports?${params}`;
}
function addLocation(id: string, selectedAreaId: string, name: string, selectedOrgId = orgId) {
  memoryStore.sellingLocations.set(id, { id, organizationId: selectedOrgId, areaId: selectedAreaId, name, status: "ACTIVE", createdAt: timestamp, updatedAt: timestamp });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  memoryStore.clear();
  addLocation(locationId, areaId, "Manggarai");
  addLocation(otherLocationId, otherAreaId, "Tebet");
  addLocation(foreignLocationId, areaId, "Outlet Rahasia", "another-organization");
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "REPORT-API-01", type: "CART", status: "ACTIVE", createdAt: timestamp });
  memoryStore.operators.set(operatorId, { id: operatorId, organizationId: orgId, areaId, name: "Operator API", phoneE164: "+620000000001", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: timestamp, updatedAt: timestamp });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-29", startedAt: timestamp, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "CLOSED_ACCEPTED", clientShiftId: "client-shift-reports-api", version: 1, createdAt: timestamp, updatedAt: timestamp });
  memoryStore.sales.set("sale-reports-api", { id: "sale-reports-api", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId, businessDay: "2026-09-29", occurredAt: timestamp, serverAcceptedAt: timestamp, totalMinor: 42000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-reports-api", version: 1, createdAt: timestamp });
});
afterEach(() => { vi.unstubAllEnvs(); memoryStore.clear(); });

describe("reports API", () => {
  it("returns scoped report aggregates, effective filters and source freshness", async () => {
    const response = await getReport(request(query()));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.summary).toMatchObject({ salesMinor: 42000, completedTransactions: 1, outletCount: 2 });
    expect(payload.data.series).toHaveLength(2);
    expect(payload.data.outlets.map((outlet: { id: string }) => outlet.id)).toEqual([locationId, otherLocationId]);
    expect(payload.data.sourceWatermark).toBe(timestamp.toISOString());
    expect(payload.data).not.toHaveProperty("organizationId");
  });

  it("rejects unauthenticated and unauthorized report access while preserving scope in the service", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await getReport(request(query()))).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    expect((await getReport(request(query()))).status).toBe(403);
    vi.stubEnv("FAKE_AUTH_ROLE", "AREA_SUPERVISOR");
    vi.stubEnv("FAKE_AUTH_AREA_ID", areaId);
    const scoped = await getReport(request(query()));
    const payload = await scoped.json();
    expect(scoped.status).toBe(200);
    expect(payload.data.summary.salesMinor).toBe(42000);
    expect(payload.data.options.outlets.map((outlet: { id: string }) => outlet.id)).toEqual([locationId]);
    expect((await getReport(request(query({ outletId: otherLocationId })))).status).toBe(404);
    expect((await getReport(request(query({ outletId: foreignLocationId })))).status).toBe(404);
  });

  it("validates real calendar dates, paired range filters, range length and unknown cursor", async () => {
    expect((await getReport(request(query({ dateFrom: "2026-02-30", dateTo: "2026-03-01" })))).status).toBe(400);
    expect((await getReport(request("/api/v1/reports?dateFrom=2026-09-29"))).status).toBe(400);
    expect((await getReport(request(query({ dateFrom: "2026-08-01" })))).status).toBe(400);
    expect((await getReport(request(query({ cursor: "not-a-visible-row" })))).status).toBe(400);
  });

  it("denies exports to read-only analysts and does not write an export audit row", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "ANALYST");
    const response = await exportReport(request("/api/v1/reports/export?dateFrom=2026-09-29&dateTo=2026-09-30"));
    expect(response.status).toBe(403);
    expect(memoryStore.auditEvents.some((event) => event.action === "export.created")).toBe(false);
  });

  it("creates a formula-safe CSV from the server report and audits the exact export snapshot", async () => {
    addLocation(locationId, areaId, '=HYPERLINK("https://bad.example","open")');
    addLocation(otherLocationId, otherAreaId, "\t=1+1");
    const response = await exportReport(request("/api/v1/reports/export?dateFrom=2026-09-29&dateTo=2026-09-30"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const csv = new TextDecoder().decode(bytes);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain("SUMMARY");
    expect(csv).toContain("DAILY");
    expect(csv).toContain("OUTLET");
    expect(csv).toContain("'=HYPERLINK(\"\"https://bad.example\"\",\"\"open\"\")");
    expect(csv).toContain("'\t=1+1");
    expect(csv).toContain("42000");
    const audit = memoryStore.auditEvents.find((event) => event.action === "export.created");
    expect(audit).toMatchObject({ organizationId: orgId, actorKind: "HQ_USER", entityType: "operational_report_export" });
    expect(JSON.parse(audit?.newValueJson ?? "{}")).toMatchObject({ dateFrom: "2026-09-29", dateTo: "2026-09-30", outletRows: 2, dailyRows: 2 });
  });
});
