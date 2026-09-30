import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/v1/expenses/route";
import { GET as getExpense } from "@/app/api/v1/expenses/[expenseId]/route";
import { POST as reviewExpense } from "@/app/api/v1/expenses/[expenseId]/review/route";
import { GET as getShifts } from "@/app/api/v1/shifts/route";
import { memoryStore } from "@/server/db/memory-store";

const orgId = "00000000-0000-7000-0000-000000000001";
const operatorId = "00000000-0000-7000-0000-000000000010";
const otherOperatorId = "00000000-0000-7000-0000-000000000011";
const stallId = "00000000-0000-7000-0000-000000000020";
const otherStallId = "00000000-0000-7000-0000-000000000021";
const shiftId = "00000000-0000-7000-0000-000000000030";
const otherShiftId = "00000000-0000-7000-0000-000000000031";

function request(url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: init?.method ?? "GET", headers: init?.headers, body: init?.body === undefined ? undefined : JSON.stringify(init.body) });
}
function addStall(id: string, areaId: string) {
  memoryStore.stalls.set(id, { id, organizationId: orgId, areaId, code: `OUT-${id.slice(-2)}`, type: "CART", status: "ACTIVE", createdAt: new Date() });
}
function addShift(id: string, stall: string, operator: string, status: "OPEN" | "CLOSED" = "OPEN") {
  memoryStore.shifts.set(id, { id, organizationId: orgId, operatorId: operator, stallId: stall, businessDay: "2026-09-30", startedAt: new Date(), startLocationId: "00000000-0000-7000-0000-000000000040", openingCashMinor: 100000, currency: "IDR", status: status === "OPEN" ? "OPEN" : "CLOSED_ACCEPTED", clientShiftId: `client-${id}`, version: 1, createdAt: new Date(), updatedAt: new Date() });
}
function createBody(clientExpenseId: string, selectedShiftId = shiftId, amountMinor = 25000) {
  return { shiftId: selectedShiftId, categoryCode: "TRANSPORT", amount: { amountMinor, currency: "IDR" }, paidFrom: "CASH_BOX", clientExpenseId };
}

describe("expenses API boundary", () => {
  beforeEach(() => {
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", orgId);
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    memoryStore.clear();
    addStall(stallId, "area-a");
    addStall(otherStallId, "area-b");
    addShift(shiftId, stallId, operatorId);
    addShift(otherShiftId, otherStallId, otherOperatorId);
  });
  afterEach(() => { vi.unstubAllEnvs(); memoryStore.clear(); });

  it("requires authentication and rejects malformed filters or missing idempotency", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await GET(request("/api/v1/expenses"))).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    expect((await GET(request("/api/v1/expenses?limit=101"))).status).toBe(400);
    expect((await POST(request("/api/v1/expenses", { method: "POST", body: createBody("00000000-0000-7000-0000-000000000051") }))).status).toBe(400);
  });

  it("rejects a client expense ID already owned by another organization", async () => {
    const clientExpenseId = "00000000-0000-7000-0000-000000000057";
    memoryStore.expenses.set("foreign-expense", { id: "foreign-expense", organizationId: "org-foreign", shiftId: "foreign-shift", operatorId: "foreign-operator", category: "TRANSPORT", amountMinor: 1000, currency: "IDR", description: "", paidFrom: "CASH_BOX", reviewStatus: "SUBMITTED", clientExpenseId, incurredAt: new Date(), createdAt: new Date() });
    memoryStore.expenseByClientId.set(clientExpenseId, "foreign-expense");
    const response = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "foreign-client-id" }, body: createBody(clientExpenseId) }));
    expect(response.status).toBe(409);
    expect(memoryStore.expenses.size).toBe(1);
  });

  it("requires an open shift and permits only the assigned operator scope", async () => {
    const closedId = "00000000-0000-7000-0000-000000000032";
    addShift(closedId, stallId, operatorId, "CLOSED");
    const closed = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "closed-key" }, body: createBody("00000000-0000-7000-0000-000000000052", closedId) }));
    const other = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "other-key" }, body: createBody("00000000-0000-7000-0000-000000000053", otherShiftId) }));
    expect(closed.status).toBe(409);
    expect(other.status).toBe(403);
    expect(memoryStore.expenses.size).toBe(0);
  });

  it("filters shift choices to the authenticated area before they reach the create form", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "AREA_SUPERVISOR");
    vi.stubEnv("FAKE_AUTH_AREA_ID", "area-a");
    const inArea = await getShifts(request("/api/v1/shifts?status=OPEN&limit=100"));
    expect(inArea.status).toBe(200);
    expect((await inArea.json()).data.map((shift: { id: string }) => shift.id)).toEqual([shiftId]);
    vi.stubEnv("FAKE_AUTH_AREA_ID", "area-b");
    const otherArea = await getShifts(request("/api/v1/shifts?status=OPEN&limit=100"));
    expect((await otherArea.json()).data.map((shift: { id: string }) => shift.id)).toEqual([otherShiftId]);
  });

  it("creates a persisted expense once, replays idempotently, and serves scoped list/detail reads", async () => {
    const body = createBody("00000000-0000-7000-0000-000000000054");
    const post = () => request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "expense-create-one" }, body });
    const first = await POST(post());
    const result = await first.json();
    expect(first.status).toBe(201);
    expect(result.data).toMatchObject({ amountMinor: 25000, paidFrom: "CASH_BOX", cashImpact: "REDUCES_EXPECTED_CASH", reviewStatus: "SUBMITTED" });
    const replay = await POST(post());
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    const changedPayloadCollision = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "expense-create-different-key" }, body: { ...body, amount: { amountMinor: 45000, currency: "IDR" } } }));
    expect(changedPayloadCollision.status).toBe(409);
    expect(memoryStore.expenses.size).toBe(1);
    expect(memoryStore.auditEvents.some((event) => event.action === "expense.submitted")).toBe(true);

    const list = await GET(request("/api/v1/expenses?businessDay=2026-09-30&category=TRANSPORT"));
    expect(list.status).toBe(200);
    expect((await list.json()).data).toHaveLength(1);
    const detail = await getExpense(request(`/api/v1/expenses/${result.data.id}`), { params: Promise.resolve({ expenseId: result.data.id }) });
    expect(detail.status).toBe(200);

    vi.stubEnv("FAKE_OPERATOR_ID", otherOperatorId);
    const hidden = await getExpense(request(`/api/v1/expenses/${result.data.id}`), { params: Promise.resolve({ expenseId: result.data.id }) });
    expect(hidden.status).toBe(404);
  });

  it("keeps validation failures from changing state and allows an authorized reviewer without leaking review text to operators", async () => {
    const invalid = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "invalid-amount" }, body: createBody("00000000-0000-7000-0000-000000000055", shiftId, 0) }));
    expect(invalid.status).toBe(400);
    expect(memoryStore.expenses.size).toBe(0);

    const created = await POST(request("/api/v1/expenses", { method: "POST", headers: { "Idempotency-Key": "reviewable-create" }, body: createBody("00000000-0000-7000-0000-000000000056") }));
    const data = (await created.json()).data;
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_OPS");
    const decision = await reviewExpense(request(`/api/v1/expenses/${data.id}/review`, { method: "POST", headers: { "Idempotency-Key": "review-key" }, body: { decision: "REVIEWED", reason: "Jumlah sudah diperiksa" } }), { params: Promise.resolve({ expenseId: data.id }) });
    expect(decision.status).toBe(200);
    expect(memoryStore.expenses.get(data.id)?.reviewStatus).toBe("REVIEWED");
    expect(memoryStore.expenses.get(data.id)?.reviewReason).toBe("Jumlah sudah diperiksa");
    expect(memoryStore.auditEvents.find((event) => event.action === "expense.reviewed")?.actorRole).toBe("HQ_OPS");

    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    const detail = await getExpense(request(`/api/v1/expenses/${data.id}`), { params: Promise.resolve({ expenseId: data.id }) });
    expect((await detail.json()).data.reviewReason).toBeUndefined();
  });
});
