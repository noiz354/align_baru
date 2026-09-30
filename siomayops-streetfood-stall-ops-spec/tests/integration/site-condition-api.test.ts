import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getSiteCondition, POST as saveSiteCondition } from "@/app/api/v1/operators/me/site-condition/route";
import { memoryStore } from "@/server/db/memory-store";
import { logger } from "@/server/telemetry/logger";

const orgId = "10000000-0000-7000-0000-000000000001";
const foreignOrgId = "10000000-0000-7000-0000-000000000099";
const areaId = "20000000-0000-7000-0000-000000000001";
const operatorId = "30000000-0000-7000-0000-000000000001";
const otherOperatorId = "30000000-0000-7000-0000-000000000002";
const stallId = "40000000-0000-7000-0000-000000000001";
const shiftId = "50000000-0000-7000-0000-000000000001";
const otherShiftId = "50000000-0000-7000-0000-000000000002";
const locationId = "60000000-0000-7000-0000-000000000001";
const otherLocationId = "60000000-0000-7000-0000-000000000002";
const saleId = "70000000-0000-7000-0000-000000000001";
const otherSaleId = "70000000-0000-7000-0000-000000000002";
const now = new Date("2026-09-30T05:00:00.000Z");

function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function seed() {
  for (const id of [operatorId, otherOperatorId]) {
    memoryStore.operators.set(id, {
      id, organizationId: orgId, areaId, name: "Private Operator", phoneE164: "+620000000001",
      status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now,
    });
  }
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "PDG-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Pasar Raya", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId, name: "Lapangan", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-site-1", version: 1, createdAt: now, updatedAt: now });
  memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId: orgId, operatorId: otherOperatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: otherLocationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-site-2", version: 1, createdAt: now, updatedAt: now });
  memoryStore.sales.set(saleId, {
    id: saleId, organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId,
    businessDay: "2026-09-30", occurredAt: now, serverAcceptedAt: now, totalMinor: 25000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-site-condition", version: 1, createdAt: now,
  });
  memoryStore.sales.set(otherSaleId, {
    id: otherSaleId, organizationId: orgId, shiftId, sellingLocationId: otherLocationId, operatorId, stallId,
    businessDay: "2026-09-30", occurredAt: now, serverAcceptedAt: now, totalMinor: 99000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-other-location", version: 1, createdAt: now,
  });
}

const observationBody = (clientRequestId: string, overrides: Record<string, unknown> = {}) => ({
  clientRequestId,
  groundCondition: "WET",
  shelterStatus: "NOT_AVAILABLE",
  shelterNote: "Sisi timur tidak terlindung",
  relocationDecisionNote: "Tinjau titik yang lebih teduh",
  ...overrides,
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
  vi.stubEnv("TRAFFIC_SAMPLING_ENABLED", "true");
  memoryStore.clear();
  seed();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("Page 12 operator site-condition API", () => {
  it("returns server-derived location, site-filtered active-shift sales, and an explicit missing-weather fallback", async () => {
    const info = vi.spyOn(logger, "info");
    const response = await getSiteCondition();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.currentLocation).toMatchObject({ name: "Pasar Raya", status: "ACTIVE" });
    expect(body.activeShift).toMatchObject({ businessDay: "2026-09-30", stallCode: "PDG-01" });
    expect(body.weather).toEqual({ status: "UNAVAILABLE", source: null, reason: "PROVIDER_NOT_CONFIGURED", observedAt: null, temperatureCelsius: null, precipitationMillimeters: null });
    expect(body.recentSales).toMatchObject({ status: "AVAILABLE", sourceScope: "ACTIVE_SHIFT_AND_LOCATION", records: [{ totalMinor: 25000, currency: "IDR" }] });
    expect(body.recentSales.records).toHaveLength(1);
    expect(body.assessment.cue).toBe("INSUFFICIENT_DATA");
    expect(body).not.toHaveProperty("gpsSample");
    expect(JSON.stringify(body)).not.toContain(otherLocationId);
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "site_condition_viewed")).toBe(true);
  });

  it("persists an observation, refreshes the cue/history, audits no free text, and replays idempotently", async () => {
    const info = vi.spyOn(logger, "info");
    const clientRequestId = "70000000-0000-7000-8000-000000000012";
    const body = observationBody(clientRequestId);
    const first = await saveSiteCondition(request("/api/v1/operators/me/site-condition", body, { "Idempotency-Key": clientRequestId }));
    expect(first.status).toBe(201);
    expect(first.headers.get("Cache-Control")).toContain("no-store");
    const firstBody = await first.json();
    expect(firstBody.observation).toMatchObject({ groundCondition: "WET", shelterStatus: "NOT_AVAILABLE", shelterNote: "Sisi timur tidak terlindung" });
    expect(firstBody.observation).not.toHaveProperty("operatorId");
    expect(memoryStore.siteConditionObservations.size).toBe(1);
    const saved = [...memoryStore.siteConditionObservations.values()][0]!;
    expect(saved).toMatchObject({ organizationId: orgId, operatorId, shiftId, sellingLocationId: locationId, clientRequestId });
    expect(saved.observedAt).toBeInstanceOf(Date);
    const auditText = JSON.stringify(memoryStore.auditEvents);
    expect(auditText).toContain("site_condition.observation_saved");
    expect(auditText).not.toContain("Sisi timur tidak terlindung");
    expect(auditText).not.toContain("Tinjau titik yang lebih teduh");
    expect(JSON.stringify(info.mock.calls)).not.toContain("Sisi timur tidak terlindung");
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "site_observation_saved")).toBe(true);

    const reread = await getSiteCondition();
    const readBody = await reread.json();
    expect(readBody.observations).toHaveLength(1);
    expect(readBody.assessment).toMatchObject({ cue: "REVIEW_SHELTER", reason: "WET_GROUND_WITHOUT_SHELTER", weatherIntegrated: false });
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "relocation_recommendation_viewed")).toBe(true);

    const replay = await saveSiteCondition(request("/api/v1/operators/me/site-condition", body, { "Idempotency-Key": clientRequestId }));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.siteConditionObservations.size).toBe(1);
  });

  it("rejects unauthenticated, non-operator, foreign-tenant, spoofed-scope and unauthorized writes", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await getSiteCondition()).status).toBe(401);
    const clientRequestId = "70000000-0000-7000-8000-000000000013";
    const body = observationBody(clientRequestId);
    expect((await saveSiteCondition(request("/api/v1/operators/me/site-condition", body, { "Idempotency-Key": clientRequestId }))).status).toBe(401);

    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    expect((await getSiteCondition()).status).toBe(403);
    expect((await saveSiteCondition(request("/api/v1/operators/me/site-condition", body, { "Idempotency-Key": clientRequestId }))).status).toBe(403);

    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", foreignOrgId);
    expect((await getSiteCondition()).status).toBe(404);

    vi.stubEnv("FAKE_ORG_ID", orgId);
    const spoofed = await saveSiteCondition(request("/api/v1/operators/me/site-condition", { ...body, sellingLocationId: otherLocationId }, { "Idempotency-Key": clientRequestId }));
    expect(spoofed.status).toBe(400);
    expect(memoryStore.siteConditionObservations.size).toBe(0);
  });

  it("bounds input, enforces the idempotency header, and requires a current shift/location", async () => {
    const clientRequestId = "70000000-0000-7000-8000-000000000014";
    const invalid = await saveSiteCondition(request("/api/v1/operators/me/site-condition", observationBody(clientRequestId, { shelterNote: "x".repeat(241) }), { "Idempotency-Key": clientRequestId }));
    expect(invalid.status).toBe(400);
    const mismatch = await saveSiteCondition(request("/api/v1/operators/me/site-condition", observationBody(clientRequestId), { "Idempotency-Key": "70000000-0000-7000-8000-000000000015" }));
    expect(mismatch.status).toBe(400);

    memoryStore.shifts.delete(shiftId);
    const noShiftId = "70000000-0000-7000-8000-000000000016";
    const noShift = await saveSiteCondition(request("/api/v1/operators/me/site-condition", observationBody(noShiftId), { "Idempotency-Key": noShiftId }));
    expect(noShift.status).toBe(412);
    expect(memoryStore.siteConditionObservations.size).toBe(0);
  });

  it("only returns observations for the currently authorized location", async () => {
    const id = "80000000-0000-7000-8000-000000000001";
    memoryStore.siteConditionObservations.set(id, {
      id, organizationId: orgId, operatorId, shiftId, sellingLocationId: locationId, observedAt: now,
      groundCondition: "WET", shelterStatus: "NOT_AVAILABLE", clientRequestId: id, createdAt: now,
    });
    vi.stubEnv("FAKE_OPERATOR_ID", otherOperatorId);
    const response = await getSiteCondition();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentLocation.name).toBe("Lapangan");
    expect(body.observations).toEqual([]);
    expect(JSON.stringify(body)).not.toContain(operatorId);
  });

  it("purges expired site observations opportunistically without retaining their note or idempotency key", async () => {
    const id = "80000000-0000-7000-8000-000000000002";
    const requestId = "80000000-0000-7000-8000-000000000003";
    const expiredAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
    memoryStore.siteConditionObservations.set(id, {
      id, organizationId: orgId, operatorId, shiftId, sellingLocationId: locationId, observedAt: expiredAt,
      groundCondition: "WET", shelterStatus: "UNKNOWN", shelterNote: "expired private note", clientRequestId: requestId, createdAt: expiredAt,
    });
    memoryStore.siteConditionObservationByClientId.set(`${orgId}|${requestId}`, id);
    const response = await getSiteCondition();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(memoryStore.siteConditionObservations.has(id)).toBe(false);
    expect(memoryStore.siteConditionObservationByClientId.has(`${orgId}|${requestId}`)).toBe(false);
    expect(JSON.stringify(body)).not.toContain("expired private note");
  });
});
