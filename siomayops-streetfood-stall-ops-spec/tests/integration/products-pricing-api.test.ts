import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as listProducts, POST as createProduct } from "@/app/api/v1/menu/items/route";
import { PATCH as changeProductStatus } from "@/app/api/v1/menu/items/[menuItemId]/status/route";
import { GET as listPrices, POST as createPrice } from "@/app/api/v1/menu/prices/route";
import { createSale } from "@/features/sales";
import { publishPricePolicy } from "@/features/pricing";
import { memoryStore } from "@/server/db/memory-store";
import { money } from "@/shared/money/money";

const orgId = "00000000-0000-7000-0000-000000000001";
const otherOrgId = "00000000-0000-7000-0000-000000000099";
const categoryId = "00000000-0000-7000-0000-000000000050";
const itemId = "00000000-0000-7000-0000-000000000101";
const newItemId = "00000000-0000-7000-0000-000000000102";
const areaId = "00000000-0000-7000-0000-000000000003";
const locationId = "00000000-0000-7000-0000-000000000030";
const stallId = "00000000-0000-7000-0000-000000000020";
const operatorId = "00000000-0000-7000-0000-000000000010";
const shiftId = "00000000-0000-7000-0000-000000000040";

function request(url: string, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: init?.method ?? "GET", headers: init?.headers, body: init?.body === undefined ? undefined : JSON.stringify(init.body) });
}
function addProduct(id = itemId, organizationId = orgId, active = true) {
  memoryStore.menuItems.set(id, { id, organizationId, categoryId, name: id === itemId ? "Siomay Tes" : "Produk Tes", active, sortOrder: id === itemId ? 1 : 2, createdAt: new Date() });
}
function addLocation(id = locationId, organizationId = orgId, selectedAreaId = areaId) {
  memoryStore.sellingLocations.set(id, { id, organizationId, areaId: selectedAreaId, name: "Titik Jual Tes", status: "AVAILABLE", createdAt: new Date(), updatedAt: new Date() });
}
function policyBody(scopeId = locationId, effectiveFrom = "2026-09-30T00:00:00.000Z", amountMinor = 17000) {
  return { menuItemId: itemId, scope: "LOCATION", scopeId, unitPrice: { amountMinor, currency: "IDR" }, effectiveFrom, reason: "Penyesuaian harga lokasi" };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("FAKE_AUTH_ROLE", "MENU_PRICING_ADMIN");
  vi.stubEnv("FAKE_ORG_ID", orgId);
  memoryStore.clear();
  memoryStore.menuCategories.set(categoryId, { id: categoryId, organizationId: orgId, name: "Makanan", sortOrder: 1 });
  addProduct();
  addLocation();
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "OUT-01", type: "CART", status: "ACTIVE", createdAt: new Date() });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-30", startedAt: new Date(), startLocationId: locationId, openingCashMinor: 50000, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-pricing", version: 1, createdAt: new Date(), updatedAt: new Date() });
});
afterEach(() => { vi.unstubAllEnvs(); memoryStore.clear(); });

describe("products and pricing API", () => {
  it("returns real organization-scoped products, category, capability flags and resolved current price", async () => {
    await publishPricePolicy({ menuItemId: itemId, scope: "ORG", scopeId: orgId, unitPrice: money(15000), effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), reason: "Harga awal", organizationId: orgId, createdBy: "seed-test" });
    addProduct("foreign-product", otherOrgId);
    const response = await listProducts(request("/api/v1/menu/items?status=ACTIVE"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({ id: itemId, categoryName: "Makanan", active: true, basePrice: { amountMinor: 15000 }, effectivePriceState: "RESOLVED" });
    expect(payload.capabilities).toEqual({ canManageProducts: true, canManagePrices: true });
    expect(payload.scopeOptions.locations).toMatchObject([{ id: locationId, name: "Titik Jual Tes", areaId }]);
  });

  it("requires authentication and keeps view and write permissions separate", async () => {
    vi.stubEnv("FAKE_AUTH_ROLE", "INVALID_ROLE");
    expect((await listProducts(request("/api/v1/menu/items"))).status).toBe(401);
    vi.stubEnv("FAKE_AUTH_ROLE", "ANALYST");
    expect((await listProducts(request("/api/v1/menu/items"))).status).toBe(403);
    vi.stubEnv("FAKE_AUTH_ROLE", "OPERATOR");
    vi.stubEnv("FAKE_OPERATOR_ID", operatorId);
    const view = await listProducts(request("/api/v1/menu/items"));
    expect(view.status).toBe(200);
    expect((await view.json()).capabilities).toMatchObject({ canManageProducts: false, canManagePrices: false });
    const deniedPrice = await createPrice(request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "denied-price" }, body: policyBody() }));
    const deniedProduct = await createProduct(request("/api/v1/menu/items", { method: "POST", headers: { "Idempotency-Key": "denied-product" }, body: { name: "Item", categoryId, reason: "Alasan jelas" } }));
    expect(deniedPrice.status).toBe(403);
    expect(deniedProduct.status).toBe(403);
    expect(memoryStore.pricePolicies.size).toBe(0);
    expect(memoryStore.menuItems.size).toBe(1);
  });

  it("creates a simple catalog product once, audits it, and rejects foreign categories", async () => {
    const body = { name: "  Item Baru  ", categoryId, reason: "Katalog perlu item baru" };
    const post = () => request("/api/v1/menu/items", { method: "POST", headers: { "Idempotency-Key": "product-create-once" }, body });
    const first = await createProduct(post());
    expect(first.status).toBe(201);
    const created = (await first.json()).data;
    expect(created).toMatchObject({ name: "Item Baru", categoryId, active: true });
    expect(memoryStore.menuItems.has(created.id)).toBe(true);
    expect(memoryStore.auditEvents.some((event) => event.action === "menu.item_upserted" && event.entityId === created.id)).toBe(true);
    const replay = await createProduct(post());
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.menuItems.size).toBe(2);
    memoryStore.menuCategories.set("00000000-0000-7000-0000-000000000060", { id: "00000000-0000-7000-0000-000000000060", organizationId: otherOrgId, name: "Foreign", sortOrder: 1 });
    const foreign = await createProduct(request("/api/v1/menu/items", { method: "POST", headers: { "Idempotency-Key": "foreign-category" }, body: { name: "Item Lain", categoryId: "00000000-0000-7000-0000-000000000060", reason: "Kategori tidak satu organisasi" } }));
    expect(foreign.status).toBe(404);
    expect(memoryStore.menuItems.size).toBe(2);
  });

  it("publishes scoped prices through an idempotent audited write and resolves a location override", async () => {
    await publishPricePolicy({ menuItemId: itemId, scope: "ORG", scopeId: orgId, unitPrice: money(15000), effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), reason: "Harga dasar", organizationId: orgId, createdBy: "seed-test" });
    const body = policyBody(locationId, "2026-09-30T00:00:00.000Z", 17000);
    const post = () => request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "price-policy-create" }, body });
    const first = await createPrice(post());
    const firstData = await first.json();
    expect(first.status).toBe(201);
    expect(memoryStore.pricePolicies.get(firstData.data.pricePolicyId)).toMatchObject({ scope: "LOCATION", scopeId: locationId, unitPriceMinor: 17000 });
    const audit = memoryStore.auditEvents.find((event) => event.entityId === firstData.data.pricePolicyId);
    expect(audit?.action).toBe("price.policy_published");
    expect(JSON.parse(audit?.previousValueJson ?? "{}")).toMatchObject({ unitPriceMinor: null });
    expect(JSON.parse(audit?.newValueJson ?? "{}")).toMatchObject({ unitPriceMinor: 17000, effectiveFrom: "2026-09-30T00:00:00.000Z" });
    const replay = await createPrice(post());
    expect(replay.status).toBe(201);
    expect(replay.headers.get("X-Idempotent-Replayed")).toBe("true");
    expect(memoryStore.pricePolicies.size).toBe(2);

    const catalog = await listProducts(request(`/api/v1/menu/items?sellingLocationId=${locationId}`));
    expect((await catalog.json()).data[0].effectivePrice).toMatchObject({ amountMinor: 17000, scope: "LOCATION" });
    const prices = await listPrices(request(`/api/v1/menu/prices?sellingLocationId=${locationId}`));
    expect((await prices.json()).data[0]).toMatchObject({ menuItemId: itemId, unitPriceMinor: 17000, pricePolicyId: firstData.data.pricePolicyId });
  });

  it("rejects mismatched or unknown scopes, non-positive amounts, exact-time collisions, and missing idempotency", async () => {
    const badScope = await createPrice(request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "bad-scope" }, body: policyBody("00000000-0000-7000-0000-000000000090") }));
    const badAmount = await createPrice(request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "bad-amount" }, body: policyBody(locationId, "2026-09-30T00:00:00.000Z", 0) }));
    const noKey = await createPrice(request("/api/v1/menu/prices", { method: "POST", body: policyBody() }));
    expect(badScope.status).toBe(404);
    expect(badAmount.status).toBe(400);
    expect(noKey.status).toBe(400);
    const body = policyBody(locationId, "2026-09-30T00:00:00.000Z", 17000);
    expect((await createPrice(request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "first-at-time" }, body }))).status).toBe(201);
    const collision = await createPrice(request("/api/v1/menu/prices", { method: "POST", headers: { "Idempotency-Key": "second-at-time" }, body: { ...body, unitPrice: { amountMinor: 18000, currency: "IDR" } } }));
    expect(collision.status).toBe(409);
    expect(memoryStore.pricePolicies.size).toBe(1);
  });

  it("prevents retirement while a current/future price policy exists and makes inactive items unsellable", async () => {
    await publishPricePolicy({ menuItemId: itemId, scope: "ORG", scopeId: orgId, unitPrice: money(15000), effectiveFrom: new Date("2026-09-01T00:00:00.000Z"), reason: "Harga dasar", organizationId: orgId, createdBy: "seed-test" });
    const blocked = await changeProductStatus(request(`/api/v1/menu/items/${itemId}/status`, { method: "PATCH", headers: { "Idempotency-Key": "deactivate-priced" }, body: { active: false, reason: "Tidak lagi digunakan" } }), { params: Promise.resolve({ menuItemId: itemId }) });
    expect(blocked.status).toBe(409);
    expect(memoryStore.menuItems.get(itemId)?.active).toBe(true);

    addProduct(newItemId, orgId, false);
    const activated = await changeProductStatus(request(`/api/v1/menu/items/${newItemId}/status`, { method: "PATCH", headers: { "Idempotency-Key": "activate-unpriced" }, body: { active: true, reason: "Item tersedia kembali" } }), { params: Promise.resolve({ menuItemId: newItemId }) });
    expect(activated.status).toBe(200);
    const deactivated = await changeProductStatus(request(`/api/v1/menu/items/${newItemId}/status`, { method: "PATCH", headers: { "Idempotency-Key": "deactivate-unpriced" }, body: { active: false, reason: "Item tidak lagi dijual" } }), { params: Promise.resolve({ menuItemId: newItemId }) });
    expect(deactivated.status).toBe(200);
    expect(memoryStore.menuItems.get(newItemId)?.active).toBe(false);
    expect(memoryStore.auditEvents.filter((event) => event.action === "menu.item_status_changed" && event.entityId === newItemId)).toHaveLength(2);
    await expect(createSale({ shiftId, lines: [{ menuItemId: newItemId, quantity: 1 }], clientSaleId: "00000000-0000-7000-0000-000000000070", organizationId: orgId })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", status: 409 });
    expect(memoryStore.sales.size).toBe(0);
  });

  it("hides a foreign-tenant direct status mutation and does not expose foreign products in filtered reads", async () => {
    addProduct("00000000-0000-7000-0000-000000000080", otherOrgId);
    const response = await changeProductStatus(request("/api/v1/menu/items/00000000-0000-7000-0000-000000000080/status", { method: "PATCH", headers: { "Idempotency-Key": "foreign-product-status" }, body: { active: false, reason: "Permintaan status" } }), { params: Promise.resolve({ menuItemId: "00000000-0000-7000-0000-000000000080" }) });
    expect(response.status).toBe(404);
    expect((await listProducts(request("/api/v1/menu/items?search=Produk"))).status).toBe(200);
    const payload = await (await listProducts(request("/api/v1/menu/items"))).json();
    expect(payload.data.some((item: { id: string }) => item.id === "00000000-0000-7000-0000-000000000080")).toBe(false);
  });
});
