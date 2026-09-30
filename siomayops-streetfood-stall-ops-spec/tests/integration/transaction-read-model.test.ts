import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "@/server/db/memory-store";
import type { SessionContext } from "@/server/auth/port";
import { getTransaction, listTransactions } from "@/features/sales/transactions";

const orgId = "org-transactions";
const otherOrg = "org-other";
const stallId = "stall-one";
const otherStallId = "stall-two";
const ownShiftId = "shift-own";
const otherShiftId = "shift-other";
const ownSaleId = "sale-own";
const otherOrgSaleId = "sale-other-org";
const operatorId = "operator-one";

function session(scope: SessionContext["scope"] = { kind: "org", organizationId: orgId }): SessionContext {
  return { organizationId: orgId, userId: "user-one", operatorId, roles: ["HQ_OPS"], scope, sessionIssuedAt: new Date() };
}

describe("transaction read model", () => {
  beforeEach(() => {
    memoryStore.clear();
    memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId: "area-one", code: "OUT-01", type: "CART", status: "ACTIVE", createdAt: new Date() });
    memoryStore.stalls.set(otherStallId, { id: otherStallId, organizationId: orgId, areaId: "area-two", code: "OUT-02", type: "CART", status: "ACTIVE", createdAt: new Date() });
    memoryStore.shifts.set(ownShiftId, { id: ownShiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-29", startedAt: new Date("2026-09-29T02:00:00Z"), startLocationId: "loc-one", openingCashMinor: 10000, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-one", version: 1, createdAt: new Date(), updatedAt: new Date() });
    memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId: orgId, operatorId: "operator-two", stallId: otherStallId, businessDay: "2026-09-28", startedAt: new Date("2026-09-28T02:00:00Z"), startLocationId: "loc-two", openingCashMinor: 10000, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-two", version: 1, createdAt: new Date(), updatedAt: new Date() });
    memoryStore.shifts.set("shift-other-org", { id: "shift-other-org", organizationId: otherOrg, operatorId: "operator-other", stallId: "stall-other", businessDay: "2026-09-29", startedAt: new Date(), startLocationId: "loc-other", openingCashMinor: 0, currency: "IDR", status: "OPEN", clientShiftId: "client-other", version: 1, createdAt: new Date(), updatedAt: new Date() });
    memoryStore.sales.set(ownSaleId, { id: ownSaleId, organizationId: orgId, shiftId: ownShiftId, sellingLocationId: "loc-one", operatorId, stallId, businessDay: "2026-09-29", occurredAt: new Date("2026-09-29T03:00:00Z"), serverAcceptedAt: new Date("2026-09-29T03:01:00Z"), totalMinor: 15000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-one", version: 1, createdAt: new Date() });
    memoryStore.sales.set("sale-other", { id: "sale-other", organizationId: orgId, shiftId: otherShiftId, sellingLocationId: "loc-two", operatorId: "operator-two", stallId: otherStallId, businessDay: "2026-09-28", occurredAt: new Date(), serverAcceptedAt: new Date("2026-09-28T03:01:00Z"), totalMinor: 20000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-two", version: 1, createdAt: new Date() });
    memoryStore.sales.set(otherOrgSaleId, { id: otherOrgSaleId, organizationId: otherOrg, shiftId: "shift-other-org", sellingLocationId: "loc-other", operatorId: "operator-other", stallId: "stall-other", businessDay: "2026-09-29", occurredAt: new Date(), serverAcceptedAt: new Date("2026-09-29T04:01:00Z"), totalMinor: 99000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-other", version: 1, createdAt: new Date() });
    memoryStore.menuItems.set("menu-one", { id: "menu-one", organizationId: orgId, categoryId: "category-one", name: "Siomay", active: true, sortOrder: 1, createdAt: new Date() });
    memoryStore.saleItems.set("line-one", { id: "line-one", organizationId: orgId, saleId: ownSaleId, menuItemId: "menu-one", quantity: 1, unitPriceMinor: 15000, lineTotalMinor: 15000 });
    memoryStore.payments.set("payment-one", { id: "payment-one", organizationId: orgId, saleId: ownSaleId, method: "CASH", amountMinor: 15000, currency: "IDR", status: "PAID", clientPaymentId: "client-payment-one", createdAt: new Date(), updatedAt: new Date() });
  });

  it("returns persisted records with joined detail and numeric money", () => {
    const result = listTransactions(session(), { businessDay: "2026-09-29", limit: 5 });
    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({ id: ownSaleId, totalMinor: 15000, outletName: "OUT-01", paymentMethod: "CASH", paymentStatus: "PAID", lineCount: 1 });
    expect(result.outlets).toEqual([{ id: stallId, name: "OUT-01" }, { id: otherStallId, name: "OUT-02" }]);
    expect(getTransaction(session(), ownSaleId)?.lines[0]).toMatchObject({ menuItemName: "Siomay", quantity: 1, lineTotalMinor: 15000 });
  });

  it("enforces operator, area, and tenant scope in the read model", () => {
    const operatorSession = session({ kind: "self", organizationId: orgId, operatorId });
    expect(listTransactions(operatorSession).data.map((row) => row.id)).toEqual([ownSaleId]);
    expect(getTransaction(operatorSession, "sale-other")).toBeNull();
    const areaSession = session({ kind: "area", organizationId: orgId, areaId: "area-two" });
    expect(listTransactions(areaSession).data.map((row) => row.id)).toEqual(["sale-other"]);
    expect(getTransaction(session(), otherOrgSaleId)).toBeNull();
    expect(listTransactions(session()).data.map((row) => row.id)).not.toContain(otherOrgSaleId);
  });

  it("bounds list reads and applies outlet and status filters", () => {
    const result = listTransactions(session(), { stallId: otherStallId, status: "COMPLETED", limit: 1000, offset: 0 });
    expect(result.limit).toBe(100);
    expect(result.data.map((row) => row.id)).toEqual(["sale-other"]);
  });
});
