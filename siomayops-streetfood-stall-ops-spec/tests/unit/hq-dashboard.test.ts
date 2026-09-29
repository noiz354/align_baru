import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "@/server/db/memory-store";
import { getHqDashboard, getHqOutletDetail, HqDashboardNotFoundError } from "@/features/hq/dashboard";
import { dashboardResponseSchema } from "@/shared/contracts/dashboard";
import type { Scope } from "@/shared/types/scope";

const org = "org-dashboard-test";
const area = "area-dashboard-test";
const locationId = "location-dashboard-test";
const foreignLocationId = "location-other-area-test";
const shiftId = "shift-dashboard-test";
const day = "2026-09-29";
const at = new Date("2026-09-29T00:30:00.000Z");
const orgScope: Scope = { kind: "org", organizationId: org };

function seed() {
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: org, areaId: area, name: "Manggarai", status: "ACTIVE", createdAt: at, updatedAt: at });
  memoryStore.sellingLocations.set(foreignLocationId, { id: foreignLocationId, organizationId: org, areaId: "area-other", name: "Tebet", status: "ACTIVE", createdAt: at, updatedAt: at });
  memoryStore.operators.set("operator-dashboard-test", { id: "operator-dashboard-test", organizationId: org, areaId: area, name: "Dimas", phoneE164: "+620000000001", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: at, updatedAt: at });
  memoryStore.stalls.set("stall-dashboard-test", { id: "stall-dashboard-test", organizationId: org, areaId: area, code: "ST-TEST", type: "MOBILE", status: "ACTIVE", createdAt: at });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: org, operatorId: "operator-dashboard-test", stallId: "stall-dashboard-test", businessDay: day, startedAt: at, startLocationId: locationId, openingCashMinor: 50000, currency: "IDR", status: "OPEN", clientShiftId: "client-shift-dashboard-test", version: 1, createdAt: at, updatedAt: at });
  memoryStore.locationReports.set("report-dashboard-test", { id: "report-dashboard-test", organizationId: org, shiftId, stallId: "stall-dashboard-test", operatorId: "operator-dashboard-test", sellingLocationId: locationId, trigger: "ARRIVED", arrivedAt: at, clientReportId: "client-report-dashboard-test", createdAt: at });
  memoryStore.sales.set("sale-completed-test", { id: "sale-completed-test", organizationId: org, shiftId, sellingLocationId: locationId, operatorId: "operator-dashboard-test", stallId: "stall-dashboard-test", businessDay: day, occurredAt: at, serverAcceptedAt: at, totalMinor: 20000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-completed-test", version: 1, createdAt: at });
  memoryStore.sales.set("sale-pending-test", { id: "sale-pending-test", organizationId: org, shiftId, sellingLocationId: locationId, operatorId: "operator-dashboard-test", stallId: "stall-dashboard-test", businessDay: day, occurredAt: at, serverAcceptedAt: at, totalMinor: 5000, currency: "IDR", status: "DRAFT", clientSaleId: "client-sale-pending-test", version: 1, createdAt: at });
  memoryStore.sales.set("sale-previous-day-test", { id: "sale-previous-day-test", organizationId: org, shiftId, sellingLocationId: locationId, operatorId: "operator-dashboard-test", stallId: "stall-dashboard-test", businessDay: "2026-09-28", occurredAt: new Date("2026-09-28T03:00:00.000Z"), serverAcceptedAt: new Date("2026-09-28T03:00:00.000Z"), totalMinor: 10000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-previous-test", version: 1, createdAt: new Date("2026-09-28T03:00:00.000Z") });
  memoryStore.payments.set("payment-cash-test", { id: "payment-cash-test", organizationId: org, saleId: "sale-completed-test", method: "CASH", amountMinor: 20000, currency: "IDR", status: "PAID", clientPaymentId: "client-payment-cash-test", createdAt: at, updatedAt: at });
  memoryStore.payments.set("payment-unverified-test", { id: "payment-unverified-test", organizationId: org, saleId: "sale-pending-test", method: "QRIS_STATIC", amountMinor: 5000, currency: "IDR", status: "PENDING_VERIFICATION", clientPaymentId: "client-payment-unverified-test", createdAt: at, updatedAt: at });
  memoryStore.expenses.set("expense-dashboard-test", { id: "expense-dashboard-test", organizationId: org, shiftId, operatorId: "operator-dashboard-test", sellingLocationId: locationId, category: "PARKING", amountMinor: 5000, currency: "IDR", description: "Parkir", paidFrom: "CASH_BOX", reviewStatus: "SUBMITTED", clientExpenseId: "client-expense-dashboard-test", incurredAt: at, createdAt: at });
  memoryStore.auditEvents.push({ id: "audit-dashboard-test", organizationId: org, actorKind: "OPERATOR", actorId: "operator-dashboard-test", action: "expense.submitted", entityType: "expense", entityId: "expense-dashboard-test", occurredAt: at, requestId: "request-dashboard-test" });
}

beforeEach(() => { memoryStore.clear(); seed(); });
afterEach(() => { memoryStore.clear(); });

describe("HQ dashboard read model", () => {
  it("derives day totals, completed counts, payment split, expenses and trend from persisted records", () => {
    const model = getHqDashboard({ scope: orgScope, businessDay: day, limit: 10 });
    expect(model.kpis.salesMinor).toBe(20000);
    expect(model.kpis.transactionCount).toBe(1);
    expect(model.kpis.averageTransactionMinor).toBe(20000);
    expect(model.kpis.previousDaySalesMinor).toBe(10000);
    expect(model.kpis.salesChangeBps).toBe(10000);
    expect(model.kpis.cashSalesMinor).toBe(20000);
    expect(model.kpis.digitalVerifiedMinor).toBe(0);
    expect(model.kpis.digitalUnverifiedMinor).toBe(5000);
    expect(model.kpis.expensesMinor).toBe(5000);
    expect(model.kpis.expenseRatioBps).toBe(2500);
    expect(model.kpis.activeOutlets).toBe(1);
    expect(model.outlets.find((outlet) => outlet.id === locationId)?.salesMinor).toBe(20000);
    expect(model.salesTrend.at(-1)?.cumulativeMinor).toBe(20000);
    expect(model.activity[0]?.kind).toBe("EXPENSE");
    const contract = dashboardResponseSchema.safeParse({
      data: model,
      meta: { requestId: "request-dashboard-test", freshnessBand: "current" },
    });
    expect(contract.success).toBe(true);
  });

  it("enforces area scope and hides another area's outlet even when its id is requested", () => {
    const areaScope: Scope = { kind: "area", organizationId: org, areaId: area };
    const model = getHqDashboard({ scope: areaScope, businessDay: day, limit: 10 });
    expect(model.outletOptions.map((outlet) => outlet.id)).toEqual([locationId]);
    expect(() => getHqDashboard({ scope: areaScope, businessDay: day, outletId: foreignLocationId })).toThrow(HqDashboardNotFoundError);
    expect(() => getHqDashboard({ scope: areaScope, businessDay: day, areaId: "area-other" })).toThrow(HqDashboardNotFoundError);
  });

  it("does not return a cross-tenant outlet by identifier", () => {
    const otherOrgLocation = "location-other-tenant-test";
    memoryStore.sellingLocations.set(otherOrgLocation, { id: otherOrgLocation, organizationId: "other-tenant", areaId: "area-z", name: "Private Outlet", status: "ACTIVE", createdAt: at, updatedAt: at });
    expect(() => getHqDashboard({ scope: orgScope, businessDay: day, outletId: otherOrgLocation })).toThrow(HqDashboardNotFoundError);
  });

  it("rechecks outlet scope on drill-down and only exposes source records for the selected outlet", () => {
    const detail = getHqOutletDetail({ scope: orgScope, businessDay: day, outletId: locationId, limit: 10 });
    expect(detail.outlet.name).toBe("Manggarai");
    expect(detail.transactions.map((transaction) => transaction.id)).toEqual(["sale-completed-test"]);
    expect(detail.expenses.map((expense) => expense.id)).toEqual(["expense-dashboard-test"]);
    const areaScope: Scope = { kind: "area", organizationId: org, areaId: "area-other" };
    expect(() => getHqOutletDetail({ scope: areaScope, businessDay: day, outletId: locationId })).toThrow(HqDashboardNotFoundError);
  });

  it("applies area, search and cursor pagination after server-side scoping", () => {
    const all = getHqDashboard({ scope: orgScope, businessDay: day, limit: 10 });
    expect(all.areaOptions.map((option) => option.id)).toEqual([area, "area-other"]);
    expect(getHqDashboard({ scope: orgScope, businessDay: day, areaId: area, limit: 10 }).outletOptions.map((outlet) => outlet.id)).toEqual([locationId]);

    const first = getHqDashboard({ scope: orgScope, businessDay: day, search: "Manggarai", limit: 1 });
    expect(first.outlets).toHaveLength(1);
    expect(first.outlets[0]?.name).toBe("Manggarai");
    expect(first.pagination.total).toBe(1);
    expect(getHqDashboard({ scope: orgScope, businessDay: day, status: "OPERATING", limit: 10 }).outlets.map((row) => row.name)).toContain("Manggarai");
  });
});
