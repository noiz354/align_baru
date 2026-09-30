import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/v1/transactions/route";
import { GET as getDetail } from "@/app/api/v1/transactions/[transactionId]/route";
import { memoryStore } from "@/server/db/memory-store";
import { publishPricePolicy } from "@/features/pricing";
import { money } from "@/shared/money/money";

const orgId = "00000000-0000-7000-0000-000000000001";
const operatorId = "operator-transactions-api";
const shiftId = "shift-transactions-api";
const stallId = "stall-transactions-api";
const locationId = "location-transactions-api";
const menuItemId = "menu-transactions-api";

function request(url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

function payload(clientSaleId: string, clientPaymentId: string) {
  return { shiftId, clientSaleId, clientPaymentId, lines: [{ menuItemId, quantity: 1 }], cashReceivedMinor: 20000 };
}

describe("transactions API boundary", () => {
  beforeEach(async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_ORG_ID", orgId);
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    memoryStore.clear();
    memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId: "area-transactions-api", code: "OUT-TX", type: "CART", status: "ACTIVE", createdAt: new Date() });
    memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId: "area-transactions-api", name: "Lokasi Tes", status: "AVAILABLE", createdAt: new Date(), updatedAt: new Date() });
    memoryStore.menuItems.set(menuItemId, { id: menuItemId, organizationId: orgId, categoryId: "category-transactions-api", name: "Menu Tes", active: true, sortOrder: 0, createdAt: new Date() });
    await publishPricePolicy({ menuItemId, scope: "ORG", scopeId: orgId, unitPrice: money(15000, "IDR"), effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), reason: "Initial policy", organizationId: orgId, createdBy: "test" });
    memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: new Date(), startLocationId: locationId, openingCashMinor: 50000, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-transactions-api", version: 1, createdAt: new Date(), updatedAt: new Date() });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("requires authentication for list and detail reads", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    const list = await GET(request("/api/v1/transactions"));
    const detail = await getDetail(request("/api/v1/transactions/unknown"), { params: Promise.resolve({ transactionId: "unknown" }) });
    expect(list.status).toBe(401);
    expect(detail.status).toBe(401);
  });

  it("denies a read-only finance role a cash transaction write", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "HQ_FINANCE");
    const response = await POST(request("/api/v1/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "write-forbidden" }, body: payload("sale-forbidden", "payment-forbidden") }));
    expect(response.status).toBe(403);
    expect(memoryStore.sales.size).toBe(0);
  });

  it("creates one persisted transaction and replays an identical request once", async () => {
    const body = payload("sale-api-one", "payment-api-one");
    const create = () => request("/api/v1/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "tx-api-key" }, body });
    const first = await POST(create());
    const firstData = await first.json();
    expect(first.status).toBe(201);
    expect(firstData.data).toMatchObject({ totalMinor: 15000, changeMinor: 5000, status: "PAID" });
    const replay = await POST(create());
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.sales.size).toBe(1);
    expect(memoryStore.payments.size).toBe(1);

    const list = await GET(request("/api/v1/transactions?businessDay=2026-09-30"));
    expect(list.status).toBe(200);
    expect((await list.json()).data).toHaveLength(1);
    const detail = await getDetail(request(`/api/v1/transactions/${firstData.data.transactionId}`), { params: Promise.resolve({ transactionId: firstData.data.transactionId }) });
    expect(detail.status).toBe(200);
    expect((await detail.json()).data.payments).toHaveLength(1);
  });

  it("hides a cross-tenant transaction at the direct detail URL and rejects a colliding client sale id", async () => {
    memoryStore.sales.set("foreign-sale", { id: "foreign-sale", organizationId: "org-foreign", shiftId: "foreign-shift", sellingLocationId: "foreign-location", operatorId: "foreign-operator", stallId: "foreign-stall", businessDay: "2026-09-30", occurredAt: new Date(), serverAcceptedAt: new Date(), totalMinor: 99000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-id-in-use", version: 1, createdAt: new Date() });
    memoryStore.saleByClientId.set("client-id-in-use", "foreign-sale");
    const detail = await getDetail(request("/api/v1/transactions/foreign-sale"), { params: Promise.resolve({ transactionId: "foreign-sale" }) });
    expect(detail.status).toBe(404);

    const collision = await POST(request("/api/v1/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "collision-key" }, body: payload("client-id-in-use", "new-payment") }));
    expect(collision.status).toBe(409);
    expect(memoryStore.sales.size).toBe(1);
  });

  it("rejects invalid input and missing idempotency without changing financial state", async () => {
    const invalid = await POST(request("/api/v1/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": "bad-input" }, body: { ...payload("bad-sale", "bad-payment"), cashReceivedMinor: -1 } }));
    const noKey = await POST(request("/api/v1/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload("no-key-sale", "no-key-payment") }));
    expect(invalid.status).toBe(400);
    expect(noKey.status).toBe(400);
    expect(memoryStore.sales.size).toBe(0);
  });
});
