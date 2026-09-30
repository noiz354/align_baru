import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getIncidentDetail } from "@/app/api/v1/hq/incidents/[incidentId]/route";
import { GET as getIncidentInbox } from "@/app/api/v1/hq/incidents/inbox/route";
import { POST as reviewIncidentRoute } from "@/app/api/v1/hq/incidents/[incidentId]/review/route";
import { memoryStore } from "@/server/db/memory-store";
import { logger } from "@/server/telemetry/logger";

const organizationId = "10000000-0000-7000-0000-000000000071";
const foreignOrganizationId = "10000000-0000-7000-0000-000000000079";
const areaId = "20000000-0000-7000-0000-000000000071";
const otherAreaId = "20000000-0000-7000-0000-000000000072";
const operatorId = "30000000-0000-7000-0000-000000000071";
const otherOperatorId = "30000000-0000-7000-0000-000000000072";
const stallId = "40000000-0000-7000-0000-000000000071";
const otherStallId = "40000000-0000-7000-0000-000000000072";
const shiftId = "50000000-0000-7000-0000-000000000071";
const otherShiftId = "50000000-0000-7000-0000-000000000072";
const locationId = "60000000-0000-7000-0000-000000000071";
const otherLocationId = "60000000-0000-7000-0000-000000000072";
const incidentId = "70000000-0000-7000-8000-000000000071";
const otherIncidentId = "70000000-0000-7000-8000-000000000072";
const reviewId = "70000000-0000-7000-8000-000000000073";
const now = new Date();

function getRequest(path: string) { return new NextRequest(`http://localhost${path}`); }
function postRequest(path: string, body: unknown, key?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: JSON.stringify(body),
  });
}
function detailContext(id = incidentId) { return { params: Promise.resolve({ incidentId: id }) }; }
function seed() {
  memoryStore.operators.set(operatorId, { id: operatorId, organizationId, areaId, name: "Reporter One", phoneE164: "+620000000071", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now });
  memoryStore.operators.set(otherOperatorId, { id: otherOperatorId, organizationId, areaId: otherAreaId, name: "Reporter Two", phoneE164: "+620000000072", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: now, updatedAt: now });
  memoryStore.stalls.set(stallId, { id: stallId, organizationId, areaId, code: "PDG-REV-01", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.stalls.set(otherStallId, { id: otherStallId, organizationId, areaId: otherAreaId, code: "PDG-REV-02", type: "CART", status: "ACTIVE", createdAt: now });
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId, areaId, name: "Review site one", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId, areaId: otherAreaId, name: "Review site two", status: "ACTIVE", createdAt: now, updatedAt: now });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId, operatorId, stallId, businessDay: "2026-09-30", startedAt: now, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "review-shift-one", version: 1, createdAt: now, updatedAt: now });
  memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId, operatorId: otherOperatorId, stallId: otherStallId, businessDay: "2026-09-30", startedAt: now, startLocationId: otherLocationId, openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "review-shift-two", version: 1, createdAt: now, updatedAt: now });
  memoryStore.incidents.set(incidentId, { id: incidentId, organizationId, shiftId, sellingLocationId: locationId, operatorId, category: "SECURITY_CONCERN_REPORTED", severityHint: "P2", description: "Operator reports an unverified security concern at the site.", occurredAt: new Date(now.getTime() - 30 * 60 * 1000), amountMinor: 25000, amountContext: "REQUESTED", clientIncidentId: "70000000-0000-7000-8000-000000000074", status: "SUBMITTED", createdAt: now, updatedAt: now });
  memoryStore.incidents.set(otherIncidentId, { id: otherIncidentId, organizationId, shiftId: otherShiftId, sellingLocationId: otherLocationId, operatorId: otherOperatorId, category: "EQUIPMENT_DAMAGE", description: "Separate area incident report with synthetic test content.", status: "SUBMITTED", createdAt: new Date(now.getTime() - 1000), updatedAt: now });
  memoryStore.auditEvents.push({ id: "audit-submit-one", organizationId, actorId: operatorId, actorKind: "OPERATOR", action: "incident.submitted", entityType: "incident", entityId: incidentId, occurredAt: now, newValueJson: JSON.stringify({ category: "SECURITY_CONCERN_REPORTED", status: "SUBMITTED" }), requestId: "report-correlation" });
  memoryStore.auditEvents.push({ id: "audit-foreign", organizationId: foreignOrganizationId, actorKind: "OPERATOR", action: "incident.submitted", entityType: "incident", entityId: incidentId, occurredAt: now, requestId: "foreign-correlation" });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
  vi.stubEnv("FAKE_ORG_ID", organizationId);
  memoryStore.clear();
  seed();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); memoryStore.clear(); });

describe("HQ incident evidence review API", () => {
  it("returns real incident facts and bounded audit history, explicitly marks evidence unsupported, and emits only coarse view telemetry", async () => {
    const info = vi.spyOn(logger, "info");
    const response = await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(body.incident).toMatchObject({ id: incidentId, categoryCode: "SECURITY_CONCERN_REPORTED", status: "SUBMITTED", reporterName: "Reporter One", stallCode: "PDG-REV-01", locationName: "Review site one", amountMinor: 25000, evidence: { status: "UNSUPPORTED", items: [] } });
    expect(body.incident.reviewHistory).toHaveLength(1);
    expect(JSON.stringify(body.incident)).not.toContain(operatorId);
    expect(JSON.stringify(body.incident)).not.toContain(organizationId);
    expect(info.mock.calls.some(([, properties]) => (properties as any).eventName === "incident_reviewed" && (properties as any).page === "hq-incident-review")).toBe(true);
    expect(JSON.stringify(info.mock.calls)).not.toContain("unverified security concern");
    expect(JSON.stringify(info.mock.calls)).not.toContain("25000");
  });

  it("returns only current-scope incident summaries in the inbox and filters area supervisors", async () => {
    let response = await getIncidentInbox();
    let body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ id: incidentId, categoryLabel: "Kekhawatiran keamanan dilaporkan", reporterName: "Reporter One" });
    expect(JSON.stringify(body.items)).not.toContain("Separate area incident report");

    vi.stubEnv("FAKE_AUTH_ROLE", "AREA_SUPERVISOR");
    vi.stubEnv("FAKE_AUTH_AREA_ID", otherAreaId);
    response = await getIncidentInbox();
    body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(otherIncidentId);
    const outOfArea = await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext());
    expect(outOfArea.status).toBe(404);
    const outOfAreaReviewId = "70000000-0000-7000-8000-000000000080";
    const outOfAreaWrite = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: outOfAreaReviewId, status: "ACKNOWLEDGED", note: "Out of area should not mutate this report." }, outOfAreaReviewId), detailContext());
    expect(outOfAreaWrite.status).toBe(404);
    expect(memoryStore.incidents.get(incidentId)?.status).toBe("SUBMITTED");
  });

  it("appends a note-only audit event and reloads it in the detail history without logging the note", async () => {
    const info = vi.spyOn(logger, "info");
    const note = "Supervisor confirmed follow-up with the site team.";
    const response = await reviewIncidentRoute(
      postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: reviewId, note }, reviewId),
      detailContext(),
    );
    expect(response.status).toBe(200);
    expect(memoryStore.incidents.get(incidentId)?.status).toBe("SUBMITTED");
    const reviewEvent = memoryStore.auditEvents.find((event) => event.action === "incident.review_note_added");
    expect(reviewEvent?.entityId).toBe(incidentId);
    expect(reviewEvent?.newValueJson).toContain(note);
    expect(info.mock.calls.some(([, properties]) => (properties as any).eventName === "incident_review_note_added" && (properties as any).outcome === "CREATED")).toBe(true);
    expect(JSON.stringify(info.mock.calls)).not.toContain(note);
    const reread = await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext());
    const body = await reread.json();
    expect(body.incident.reviewHistory.at(-1)).toMatchObject({ action: "incident.review_note_added", note });
  });

  it("changes status with a required factual note, audits the transition, and replays without a second write", async () => {
    const clientReviewId = "70000000-0000-7000-8000-000000000075";
    const payload = { clientReviewId, status: "INVESTIGATING", note: "Operations team will verify the reported timeline." };
    const first = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, payload, clientReviewId), detailContext());
    expect(first.status).toBe(200);
    expect(memoryStore.incidents.get(incidentId)?.status).toBe("INVESTIGATING");
    expect(memoryStore.auditEvents.filter((event) => event.action === "incident.transitioned")).toHaveLength(1);
    const replay = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, payload, clientReviewId), detailContext());
    expect(replay.status).toBe(200);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.auditEvents.filter((event) => event.action === "incident.transitioned")).toHaveLength(1);
    const changed = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { ...payload, note: "Changed follow-up note for same key." }, clientReviewId), detailContext());
    expect(changed.status).toBe(422);
    expect(memoryStore.auditEvents.filter((event) => event.action === "incident.transitioned")).toHaveLength(1);
  });

  it("rejects invalid transitions and resolution without a note", async () => {
    const missingNoteId = "70000000-0000-7000-8000-000000000076";
    const missingNote = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: missingNoteId, status: "RESOLVED" }, missingNoteId), detailContext());
    expect(missingNote.status).toBe(400);
    const resolveId = "70000000-0000-7000-8000-000000000077";
    const resolve = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: resolveId, status: "RESOLVED", note: "Facts reviewed; no further action is required." }, resolveId), detailContext());
    expect(resolve.status).toBe(200);
    const invalidId = "70000000-0000-7000-8000-000000000078";
    const invalidTransition = await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: invalidId, status: "ACKNOWLEDGED" }, invalidId), detailContext());
    expect(invalidTransition.status).toBe(409);
    expect(memoryStore.incidents.get(incidentId)?.status).toBe("RESOLVED");
  });

  it("denies unauthorized roles, other tenants, and direct access to an unavailable detail", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_FINANCE");
    expect((await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext())).status).toBe(403);
    const deniedWriteId = "70000000-0000-7000-8000-000000000079";
    expect((await reviewIncidentRoute(postRequest(`/api/v1/hq/incidents/${incidentId}/review`, { clientReviewId: deniedWriteId, note: "Not permitted to add this note." }, deniedWriteId), detailContext())).status).toBe(403);

    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    vi.stubEnv("FAKE_ORG_ID", foreignOrganizationId);
    expect((await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext())).status).toBe(404);
    expect((await getIncidentDetail(getRequest("/api/v1/hq/incidents/does-not-exist"), detailContext("does-not-exist"))).status).toBe(404);

    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", organizationId);
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    expect((await getIncidentDetail(getRequest(`/api/v1/hq/incidents/${incidentId}`), detailContext())).status).toBe(403);
  });
});
