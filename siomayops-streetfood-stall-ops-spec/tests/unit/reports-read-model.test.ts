import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOperationalReport, ReportQueryError } from "@/features/reports";
import { memoryStore } from "@/server/db/memory-store";
import type { Scope } from "@/shared/types/scope";

const orgId = "org-reports-test";
const areaId = "area-reports-test";
const locationId = "location-reports-test";
const shiftId = "shift-reports-test";
const operatorId = "operator-reports-test";
const stallId = "stall-reports-test";
const orgScope: Scope = { kind: "org", organizationId: orgId };
const range = { dateFrom: "2026-09-28", dateTo: "2026-09-30" };
const dayTime = new Date("2026-09-29T12:00:00.000Z");

function seedBase() {
  memoryStore.sellingLocations.set(locationId, { id: locationId, organizationId: orgId, areaId, name: "Manggarai", status: "ACTIVE", createdAt: dayTime, updatedAt: dayTime });
  memoryStore.stalls.set(stallId, { id: stallId, organizationId: orgId, areaId, code: "REPORT-01", type: "CART", status: "ACTIVE", createdAt: dayTime });
  memoryStore.operators.set(operatorId, { id: operatorId, organizationId: orgId, areaId, name: "Operator Uji", phoneE164: "+620000000001", status: "ACTIVE", contractType: "FULL_TIME", trainingState: "TRAINED", active: true, createdAt: dayTime, updatedAt: dayTime });
  memoryStore.shifts.set(shiftId, { id: shiftId, organizationId: orgId, operatorId, stallId, businessDay: "2026-09-29", startedAt: dayTime, startLocationId: locationId, openingCashMinor: 0, currency: "IDR", status: "CLOSED_ACCEPTED", clientShiftId: "client-shift-reports", version: 1, createdAt: dayTime, updatedAt: dayTime });
}

beforeEach(() => { memoryStore.clear(); seedBase(); });
afterEach(() => { memoryStore.clear(); });

describe("operational reports read model", () => {
  it("aggregates completed sales, payment states, reported expenses and incidents into a filled daily series", () => {
    memoryStore.sales.set("sale-report-complete", { id: "sale-report-complete", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId, businessDay: "2026-09-29", occurredAt: dayTime, serverAcceptedAt: dayTime, totalMinor: 20000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-report-complete", version: 1, createdAt: dayTime });
    memoryStore.sales.set("sale-report-draft", { id: "sale-report-draft", organizationId: orgId, shiftId, sellingLocationId: locationId, operatorId, stallId, businessDay: "2026-09-29", occurredAt: dayTime, serverAcceptedAt: dayTime, totalMinor: 9000, currency: "IDR", status: "DRAFT", clientSaleId: "client-sale-report-draft", version: 1, createdAt: dayTime });
    memoryStore.payments.set("payment-report-cash", { id: "payment-report-cash", organizationId: orgId, saleId: "sale-report-complete", method: "CASH", amountMinor: 20000, currency: "IDR", status: "PAID", clientPaymentId: "client-payment-report-cash", createdAt: dayTime, updatedAt: dayTime });
    memoryStore.payments.set("payment-report-pending", { id: "payment-report-pending", organizationId: orgId, saleId: "sale-report-complete", method: "QRIS_STATIC", amountMinor: 1000, currency: "IDR", status: "PENDING_VERIFICATION", clientPaymentId: "client-payment-report-pending", createdAt: dayTime, updatedAt: dayTime });
    memoryStore.expenses.set("expense-report", { id: "expense-report", organizationId: orgId, shiftId, operatorId, category: "TRANSPORT", amountMinor: 5000, currency: "IDR", description: "Transportasi", paidFrom: "CASH_BOX", reviewStatus: "SUBMITTED", clientExpenseId: "client-expense-report", incurredAt: dayTime, createdAt: dayTime });
    memoryStore.incidents.set("incident-report", { id: "incident-report", organizationId: orgId, shiftId, operatorId, category: "EQUIPMENT", description: "Peralatan", status: "SUBMITTED", createdAt: dayTime, updatedAt: dayTime });

    const report = getOperationalReport({ scope: orgScope, ...range, now: new Date("2026-09-30T12:00:00.000Z") });
    expect(report.summary).toMatchObject({ salesMinor: 20000, completedTransactions: 1, averageTransactionMinor: 20000, cashPaidMinor: 20000, digitalVerifiedMinor: 0, digitalUnverifiedMinor: 1000, reportedExpensesMinor: 5000, salesAfterExpensesMinor: 15000, incidentCount: 1, outletCount: 1 });
    expect(report.series).toHaveLength(3);
    expect(report.series.map((point) => point.salesMinor)).toEqual([0, 20000, 0]);
    expect(report.series[1]).toMatchObject({ businessDay: "2026-09-29", reportedExpensesMinor: 5000, incidentCount: 1 });
    expect(report.outlets[0]).toMatchObject({ id: locationId, salesMinor: 20000, reportedExpensesMinor: 5000, incidentCount: 1 });
    expect(report.incidents.byStatus).toEqual({ SUBMITTED: 1 });
    expect(report.incidents.byCategory).toEqual({ EQUIPMENT: 1 });
    expect(report.sourceWatermark).toBe(dayTime.toISOString());
  });

  it("enforces area and selected-outlet scope while returning only visible source aggregates", () => {
    const otherAreaId = "area-other-reports";
    const otherLocationId = "location-other-reports";
    const otherStallId = "stall-other-reports";
    const otherShiftId = "shift-other-reports";
    memoryStore.sellingLocations.set(otherLocationId, { id: otherLocationId, organizationId: orgId, areaId: otherAreaId, name: "Tebet", status: "ACTIVE", createdAt: dayTime, updatedAt: dayTime });
    memoryStore.stalls.set(otherStallId, { id: otherStallId, organizationId: orgId, areaId: otherAreaId, code: "REPORT-02", type: "CART", status: "ACTIVE", createdAt: dayTime });
    memoryStore.shifts.set(otherShiftId, { id: otherShiftId, organizationId: orgId, operatorId, stallId: otherStallId, businessDay: "2026-09-29", startedAt: dayTime, startLocationId: otherLocationId, openingCashMinor: 0, currency: "IDR", status: "CLOSED_ACCEPTED", clientShiftId: "client-shift-report-other", version: 1, createdAt: dayTime, updatedAt: dayTime });
    memoryStore.sales.set("sale-report-other", { id: "sale-report-other", organizationId: orgId, shiftId: otherShiftId, sellingLocationId: otherLocationId, operatorId, stallId: otherStallId, businessDay: "2026-09-29", occurredAt: dayTime, serverAcceptedAt: dayTime, totalMinor: 99000, currency: "IDR", status: "COMPLETED", clientSaleId: "client-sale-report-other", version: 1, createdAt: dayTime });

    const areaScope: Scope = { kind: "area", organizationId: orgId, areaId };
    const areaReport = getOperationalReport({ scope: areaScope, ...range });
    expect(areaReport.summary.salesMinor).toBe(0);
    expect(areaReport.options.outlets.map((outlet) => outlet.id)).toEqual([locationId]);
    expect(() => getOperationalReport({ scope: areaScope, ...range, outletId: otherLocationId })).toThrow();
    expect(() => getOperationalReport({ scope: orgScope, ...range, outletId: "foreign-tenant-outlet" })).toThrow();
  });

  it("uses deterministic cursor pagination for large outlet sets", () => {
    for (let index = 0; index < 105; index++) {
      const id = `report-location-${String(index).padStart(3, "0")}`;
      memoryStore.sellingLocations.set(id, { id, organizationId: orgId, areaId, name: `Outlet ${String(index).padStart(3, "0")}`, status: "ACTIVE", createdAt: dayTime, updatedAt: dayTime });
    }
    const first = getOperationalReport({ scope: orgScope, ...range, limit: 100 });
    expect(first.outlets).toHaveLength(100);
    expect(first.pagination.total).toBe(106);
    expect(first.pagination.nextCursor).toBe(first.outlets[99]?.id);
    const second = getOperationalReport({ scope: orgScope, ...range, limit: 100, cursor: first.pagination.nextCursor ?? undefined });
    expect(second.outlets).toHaveLength(6);
    expect(second.pagination.nextCursor).toBeNull();
    expect(second.outlets[0]?.name).toBe("Outlet 099");
  });

  it("rejects incomplete, invalid, reversed, overlong and out-of-scope cursors", () => {
    expect(() => getOperationalReport({ scope: orgScope, dateFrom: "2026-09-29" })).toThrow(ReportQueryError);
    expect(() => getOperationalReport({ scope: orgScope, dateFrom: "2026-02-30", dateTo: "2026-03-01" })).toThrow(ReportQueryError);
    expect(() => getOperationalReport({ scope: orgScope, dateFrom: "2026-09-30", dateTo: "2026-09-01" })).toThrow(ReportQueryError);
    expect(() => getOperationalReport({ scope: orgScope, dateFrom: "2026-08-01", dateTo: "2026-09-30" })).toThrow(ReportQueryError);
    expect(() => getOperationalReport({ scope: orgScope, ...range, cursor: "not-a-visible-outlet" })).toThrow(ReportQueryError);
  });
});
