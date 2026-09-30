import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getOperatorLocation } from "@/app/api/v1/operators/me/location/route";
import { POST as postLocationEvent } from "@/app/api/v1/operators/me/location/events/route";
import { POST as postLocationReport } from "@/app/api/v1/shifts/[shiftId]/location-reports/route";
import { memoryStore } from "@/server/db/memory-store";
import { logger } from "@/server/telemetry/logger";

const orgId = "10000000-0000-7000-0000-000000000001";
const areaId = "20000000-0000-7000-0000-000000000001";
const operatorId = "30000000-0000-7000-0000-000000000001";
const otherOperatorId = "30000000-0000-7000-0000-000000000002";
const stallId = "40000000-0000-7000-0000-000000000001";
const shiftId = "50000000-0000-7000-0000-000000000001";
const otherShiftId = "50000000-0000-7000-0000-000000000002";
const locationId = "60000000-0000-7000-0000-000000000001";
const foreignAreaLocationId = "60000000-0000-7000-0000-000000000002";
const reportId = "70000000-0000-7000-0000-000000000001";
const existingReportClientId = "70000000-0000-7000-0000-000000000002";
const now = new Date();

function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function seed() {
  for (const id of [operatorId, otherOperatorId]) {
    memoryStore.operators.set(id, { id, organizationId: orgId, areaId, name: "Private Operator", phoneE164: "+620000000001", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now });
  }
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "PDG-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Pasar Raya", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(foreignAreaLocationId, { id: foreignAreaLocationId, organizationId: orgId, areaId: "20000000-0000-7000-0000-000000000099", name: "Area lain", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-location-1", version: 1, createdAt: now, updatedAt: now });
  memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId: orgId, operatorId: otherOperatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-location-2", version: 1, createdAt: now, updatedAt: now });
  memoryStore.locationReports.set(reportId, { id: reportId, organizationId: orgId, shiftId, stallId, operatorId, sellingLocationId: locationId, trigger: "ARRIVED", arrivedAt: now, clientReportId: existingReportClientId, createdAt: now });
}

function sample(capturedAt = new Date().toISOString()) {
  return { latitude: -0.949, longitude: 100.354, accuracyMeters: 18, capturedAt };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
  memoryStore.clear();
  seed();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("Page 10 operator location API", () => {
  it("returns a private, self-scoped active shift context and same-area choices", async () => {
    const info = vi.spyOn(logger, "info");
    const response = await getOperatorLocation();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.activeShift).toMatchObject({ shiftId, stallCode: "PDG-01" });
    expect(body.currentLocation).toMatchObject({ sellingLocationId: locationId, hasOpenReport: true });
    expect(body.locationChoices).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(foreignAreaLocationId);
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "location_page_viewed")).toBe(true);
    expect(JSON.stringify(info.mock.calls)).not.toContain("-0.949");
  });

  it("fails closed for unauthenticated access, cross-operator writes and cross-tenant writes", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await getOperatorLocation()).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    const otherClientId = "70000000-0000-7000-0000-000000000003";
    const otherRequest = request(`/api/v1/shifts/${otherShiftId}/location-reports`, {
      sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId: otherClientId,
    }, { "Idempotency-Key": otherClientId });
    const otherResponse = await postLocationReport(otherRequest, { params: Promise.resolve({ shiftId: otherShiftId }) });
    expect(otherResponse.status).toBe(403);
    expect(memoryStore.locationReportByClientId.has(otherClientId)).toBe(false);
    expect(memoryStore.locationReports.size).toBe(1);

    vi.stubEnv("FAKE_ORG_ID", "10000000-0000-7000-0000-000000000099");
    const foreignTenantId = "70000000-0000-7000-0000-000000000004";
    const foreignTenantRequest = request(`/api/v1/shifts/${shiftId}/location-reports`, {
      sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId: foreignTenantId,
    }, { "Idempotency-Key": foreignTenantId });
    const foreignTenantResponse = await postLocationReport(foreignTenantRequest, { params: Promise.resolve({ shiftId }) });
    expect(foreignTenantResponse.status).toBe(404);
    expect(memoryStore.locationReportByClientId.has(foreignTenantId)).toBe(false);
  });

  it("rejects reports when the shift owner has been suspended", async () => {
    const operator = memoryStore.operators.get(operatorId)!;
    memoryStore.operators.set(operatorId, { ...operator, active: false, status: "SUSPENDED" });
    const clientReportId = "70000000-0000-7000-0000-000000000011";
    const response = await postLocationReport(
      request(`/api/v1/shifts/${shiftId}/location-reports`, {
        sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId,
      }, { "Idempotency-Key": clientReportId }),
      { params: Promise.resolve({ shiftId }) },
    );
    expect(response.status).toBe(412);
    expect(memoryStore.locationReportByClientId.has(clientReportId)).toBe(false);
  });

  it("rejects cross-area target points even when the operator submits a valid own shift", async () => {
    const clientReportId = "70000000-0000-7000-0000-000000000005";
    const response = await postLocationReport(
      request(`/api/v1/shifts/${shiftId}/location-reports`, {
        sellingLocationId: foreignAreaLocationId, trigger: "MOVE_SITE", reasonForMove: "OTHER", clientReportId,
      }, { "Idempotency-Key": clientReportId }),
      { params: Promise.resolve({ shiftId }) },
    );
    expect(response.status).toBe(403);
    expect(memoryStore.locationReportByClientId.has(clientReportId)).toBe(false);
  });

  it("persists the explicit one-shot fix, replays idempotently, and keeps raw coordinates out of audit and telemetry", async () => {
    const info = vi.spyOn(logger, "info");
    const clientReportId = "70000000-0000-7000-0000-000000000006";
    const body = { sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId, gpsSample: sample() };
    const firstRequest = request(`/api/v1/shifts/${shiftId}/location-reports`, body, { "Idempotency-Key": clientReportId });
    const first = await postLocationReport(firstRequest, { params: Promise.resolve({ shiftId }) });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ locationReportId: reportId, gpsSampleStored: true });
    const stored = memoryStore.locationReports.get(reportId)!;
    expect(stored.gpsSample).toMatchObject({ latitude: -0.949, longitude: 100.354, accuracyMeters: 18 });
    expect(stored.gpsSample?.capturedAt).toBeInstanceOf(Date);
    const audit = memoryStore.auditEvents.map((entry) => JSON.stringify(entry)).join(" ");
    expect(audit).not.toContain("-0.949");
    expect(JSON.stringify(info.mock.calls)).not.toContain("-0.949");
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "location_saved")).toBe(true);

    const replay = await postLocationReport(request(`/api/v1/shifts/${shiftId}/location-reports`, body, { "Idempotency-Key": clientReportId }), { params: Promise.resolve({ shiftId }) });
    expect(replay.status).toBe(201);
    expect((await replay.json()).locationReportId).toBe(reportId);
    expect(memoryStore.locationReports.size).toBe(1);
  });

  it("rejects stale/invalid samples and an idempotency key that is not bound to the report", async () => {
    const staleId = "70000000-0000-7000-0000-000000000007";
    const stale = sample(new Date(Date.now() - 6 * 60_000).toISOString());
    const staleResponse = await postLocationReport(
      request(`/api/v1/shifts/${shiftId}/location-reports`, { sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId: staleId, gpsSample: stale }, { "Idempotency-Key": staleId }),
      { params: Promise.resolve({ shiftId }) },
    );
    expect(staleResponse.status).toBe(400);
    expect(memoryStore.locationReports.get(reportId)?.gpsSample).toBeUndefined();

    const invalidId = "70000000-0000-7000-0000-000000000008";
    const invalid = await postLocationReport(
      request(`/api/v1/shifts/${shiftId}/location-reports`, { sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId: invalidId, gpsSample: { ...sample(), latitude: 95 } }, { "Idempotency-Key": invalidId }),
      { params: Promise.resolve({ shiftId }) },
    );
    expect(invalid.status).toBe(400);

    const mismatchId = "70000000-0000-7000-0000-000000000009";
    const mismatch = await postLocationReport(
      request(`/api/v1/shifts/${shiftId}/location-reports`, { sellingLocationId: locationId, trigger: "CONFIRM_UNCHANGED", clientReportId: mismatchId }, { "Idempotency-Key": "70000000-0000-7000-0000-000000000010" }),
      { params: Promise.resolve({ shiftId }) },
    );
    expect(mismatch.status).toBe(400);
  });

  it("accepts only coarse self-scoped analytics events", async () => {
    const info = vi.spyOn(logger, "info");
    const response = await postLocationEvent(request("/api/v1/operators/me/location/events", { event: "location_capture_started" }));
    expect(response.status).toBe(202);
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "location_capture_started")).toBe(true);
    expect((await postLocationEvent(request("/api/v1/operators/me/location/events", { event: "location_permission_denied", reason: "network" }))).status).toBe(400);
    expect((await postLocationEvent(request("/api/v1/operators/me/location/events", { event: "location_capture_started", latitude: -0.949 }))).status).toBe(400);
    vi.stubEnv("FAKE_OPERATOR_ID", otherOperatorId);
    const noShiftContext = await getOperatorLocation();
    expect((await noShiftContext.json()).gpsSample).toBeNull();
  });
});
