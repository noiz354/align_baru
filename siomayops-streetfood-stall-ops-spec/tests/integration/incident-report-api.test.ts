import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getIncidents, POST as submitIncident } from "@/app/api/v1/incidents/route";
import { GET as getIncidentDetail } from "@/app/api/v1/incidents/[incidentId]/route";
import { memoryStore } from "@/server/db/memory-store";
import { logger } from "@/server/telemetry/logger";

const orgId = "10000000-0000-7000-0000-000000000041";
const foreignOrgId = "10000000-0000-7000-0000-000000000049";
const areaId = "20000000-0000-7000-0000-000000000041";
const operatorId = "30000000-0000-7000-0000-000000000041";
const otherOperatorId = "30000000-0000-7000-0000-000000000042";
const stallId = "40000000-0000-7000-0000-000000000041";
const shiftId = "50000000-0000-7000-0000-000000000041";
const otherShiftId = "50000000-0000-7000-0000-000000000042";
const locationId = "60000000-0000-7000-0000-000000000041";
const otherLocationId = "60000000-0000-7000-0000-000000000042";
const now = new Date();

function postRequest(body: unknown, key?: string) {
  return new NextRequest("http://localhost/api/v1/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
  });
}
function seed() {
  for (const id of [operatorId, otherOperatorId]) {
    memoryStore.operators.set(id, {
      id, organizationId: orgId, areaId, name: id === operatorId ? "Operator Self" : "Other Operator", phoneE164: "+620000000041",
      status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now,
    });
  }
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "PDG-SEC-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Pasar Contoh", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId, name: "Lokasi Contoh Lain", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "incident-self-shift", version: 1, createdAt: now, updatedAt: now });
  memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId: orgId, operatorId: otherOperatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: otherLocationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "incident-other-shift", version: 1, createdAt: now, updatedAt: now });
}
const clientIncidentId = "70000000-0000-7000-8000-000000000041";
const reportBody = (overrides: Record<string, unknown> = {}) => ({
  clientIncidentId,
  categoryCode: "UNOFFICIAL_PAYMENT_REPORTED",
  severityHint: "P2",
  description: "Operator melaporkan permintaan pembayaran di titik jual.",
  occurredAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
  amountMinor: 50000,
  amountContext: "REQUESTED",
  ...overrides,
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
  memoryStore.clear();
  seed();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("Page 13 self-scoped operator incident report API", () => {
  it("reads server-derived context and only the reporter's bounded history without GPS or scope IDs", async () => {
    const info = vi.spyOn(logger, "info");
    memoryStore.incidents.set("incident-own-old", { id: "incident-own-old", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, category: "SECURITY_CONCERN_REPORTED", description: "Riwayat milik operator sendiri", occurredAt: now, status: "SUBMITTED", createdAt: now, updatedAt: now });
    memoryStore.incidents.set("incident-other-actor", { id: "incident-other-actor", organizationId: orgId, shiftId: otherShiftId, sellingLocationId: otherLocationId, operatorId: otherOperatorId, category: "THEFT", description: "Jangan tampilkan laporan operator lain", occurredAt: now, status: "SUBMITTED", createdAt: now, updatedAt: now });
    memoryStore.incidents.set("incident-other-tenant", { id: "incident-other-tenant", organizationId: foreignOrgId, operatorId, category: "THEFT", description: "Jangan tampilkan tenant lain", status: "SUBMITTED", createdAt: now, updatedAt: now });

    const response = await getIncidents();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.currentLocation).toMatchObject({ name: "Pasar Contoh" });
    expect(body.activeShift).toMatchObject({ stallCode: "PDG-SEC-01" });
    expect(body.locationLinked).toBe(true);
    expect(body.categories.some((category: any) => category.code === "UNOFFICIAL_PAYMENT_REPORTED")).toBe(true);
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({ id: "incident-own-old", locationName: "Pasar Contoh" });
    expect(JSON.stringify(body)).not.toContain(operatorId);
    expect(JSON.stringify(body)).not.toContain(otherOperatorId);
    expect(JSON.stringify(body)).not.toContain("-6.");
    expect(JSON.stringify(body)).not.toContain("Jangan tampilkan");
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "incident_report_started")).toBe(true);
  });

  it("stores chronology, amount, current shift/location and operator hint; audit and analytics omit the narrative", async () => {
    const info = vi.spyOn(logger, "info");
    const body = reportBody();
    const response = await submitIncident(postRequest(body, clientIncidentId));
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.incident).toMatchObject({ categoryCode: "UNOFFICIAL_PAYMENT_REPORTED", severityHint: "P2", amountMinor: 50000, amountContext: "REQUESTED", status: "SUBMITTED", locationName: "Pasar Contoh" });
    expect(payload.incident).not.toHaveProperty("operatorId");
    expect(memoryStore.incidents.size).toBe(1);
    expect(memoryStore.incidentByClientId.size).toBe(1);
    const saved = [...memoryStore.incidents.values()][0]!;
    expect(saved).toMatchObject({ organizationId: orgId, operatorId, shiftId, sellingLocationId: locationId, category: "UNOFFICIAL_PAYMENT_REPORTED", severityHint: "P2", amountMinor: 50000, amountContext: "REQUESTED", status: "SUBMITTED", clientIncidentId });
    expect(saved.occurredAt).toBeInstanceOf(Date);
    const auditText = JSON.stringify(memoryStore.auditEvents);
    expect(auditText).toContain("incident.submitted");
    expect(auditText).not.toContain(body.description);
    expect(JSON.stringify(info.mock.calls)).not.toContain(body.description);
    expect(info.mock.calls.some(([, context]) => (context as any).eventName === "incident_submitted")).toBe(true);
  });

  it("replays the same client report without duplication and rejects changed content under that key", async () => {
    const body = reportBody();
    const first = await submitIncident(postRequest(body, clientIncidentId));
    expect(first.status).toBe(201);
    const replay = await submitIncident(postRequest(body, clientIncidentId));
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.incidents.size).toBe(1);
    const changed = await submitIncident(postRequest(reportBody({ description: "A different report using the same client key." }), clientIncidentId));
    expect(changed.status).toBe(422);
    expect(memoryStore.incidents.size).toBe(1);
  });

  it("rejects invalid amount/time, mismatched idempotency, and client-supplied protected scope", async () => {
    const invalidAmount = await submitIncident(postRequest(reportBody({ amountMinor: 1.5 }), clientIncidentId));
    expect(invalidAmount.status).toBe(400);
    const future = await submitIncident(postRequest(reportBody({ clientIncidentId: "70000000-0000-7000-8000-000000000042", occurredAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }), "70000000-0000-7000-8000-000000000042"));
    expect(future.status).toBe(400);
    const mismatchedKey = await submitIncident(postRequest(reportBody(), "70000000-0000-7000-8000-000000000043"));
    expect(mismatchedKey.status).toBe(400);
    const spoofed = await submitIncident(postRequest(reportBody({ shiftId: otherShiftId, sellingLocationId: otherLocationId }), clientIncidentId));
    expect(spoofed.status).toBe(400);
    expect(memoryStore.incidents.size).toBe(0);
  });

  it("permits an unlinked report without an active shift and makes the missing location explicit", async () => {
    memoryStore.shifts.delete(shiftId);
    const response = await getIncidents();
    const context = await response.json();
    expect(context.locationLinked).toBe(false);
    expect(context.currentLocation).toBeNull();
    const body = reportBody({ clientIncidentId: "70000000-0000-7000-8000-000000000044", amountMinor: undefined, amountContext: undefined });
    const created = await submitIncident(postRequest(body, body.clientIncidentId));
    expect(created.status).toBe(201);
    const row = [...memoryStore.incidents.values()][0]!;
    expect(row).toMatchObject({ operatorId, organizationId: orgId, category: "UNOFFICIAL_PAYMENT_REPORTED", status: "SUBMITTED" });
    expect(row.shiftId).toBeUndefined();
    expect(row.sellingLocationId).toBeUndefined();
  });

  it("denies unauthenticated/non-operator writes, cross-tenant reads, and direct access to another operator's incident", async () => {
    const own = await submitIncident(postRequest(reportBody(), clientIncidentId));
    const ownBody = await own.json();
    const incidentId = ownBody.incident.id as string;

    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await getIncidents()).status).toBe(401);
    expect((await submitIncident(postRequest(reportBody(), clientIncidentId))).status).toBe(401);

    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    expect((await getIncidents()).status).toBe(403);
    expect((await submitIncident(postRequest(reportBody(), clientIncidentId))).status).toBe(403);

    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", foreignOrgId);
    expect((await getIncidents()).status).toBe(404);

    vi.stubEnv("FAKE_ORG_ID", orgId);
    vi.stubEnv("FAKE_OPERATOR_ID", otherOperatorId);
    const ownOtherPage = await getIncidents();
    const otherBody = await ownOtherPage.json();
    expect(otherBody.reports).toEqual([]);
    const foreignDetail = await getIncidentDetail(new NextRequest(`http://localhost/api/v1/incidents/${incidentId}`), { params: Promise.resolve({ incidentId }) });
    expect(foreignDetail.status).toBe(404);

    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    const ownDetail = await getIncidentDetail(new NextRequest(`http://localhost/api/v1/incidents/${incidentId}`), { params: Promise.resolve({ incidentId }) });
    expect(ownDetail.status).toBe(200);
    const detailBody = await ownDetail.json();
    expect(detailBody.incident).toMatchObject({ id: incidentId, categoryCode: "UNOFFICIAL_PAYMENT_REPORTED" });
    expect(detailBody.incident).not.toHaveProperty("operatorId");
  });
});
