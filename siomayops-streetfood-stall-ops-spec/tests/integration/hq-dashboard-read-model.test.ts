import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { memoryStore, generateId, type StoredAlert, type StoredAuditEvent, type StoredExpense, type StoredLocationReport, type StoredOperator, type StoredSale, type StoredShift, type StoredStall } from "@/server/db/memory-store";
import type { SessionContext } from "@/server/auth/port";
import type { Scope } from "@/shared/types/scope";
import { getHqDashboard, getHqDashboardForSession, HqDashboardError, DASHBOARD_ACTIVITY_MAX_LIMIT } from "@/features/hq";
import { money } from "@/shared/money/money";
import { businessDayRange, DEFAULT_BUSINESS_DAY_CONFIG, fixedClock, toBusinessDay } from "@/shared/time";
import { startShift } from "@/features/shifts";
import { createSale } from "@/features/sales";
import { createCashPayment } from "@/features/payments";
import { submitExpense } from "@/features/expenses";
import { publishPricePolicy } from "@/features/pricing";

/**
 * T-HQ-002 read layer: the dashboard read model is aggregated server-side from persisted state.
 * These tests seed the real file-backed store (or the real feature services for the persistence
 * journey) and assert the read model only — no API, no UI.
 */
const ORG_A = "org-a";
const ORG_B = "org-b";
const STAFF_USER = "user-hq-1";
const DAY = "2026-09-28";
/** 17:00 Asia/Jakarta on the selected business day. */
const NOW = new Date("2026-09-28T10:00:00.000Z");
const DAY_RANGE = businessDayRange(DAY, DEFAULT_BUSINESS_DAY_CONFIG);

function sessionFor(scope: Scope, roles: SessionContext["roles"] = ["OWNER"], userId = STAFF_USER): SessionContext {
  return {
    organizationId: scope.organizationId,
    userId,
    roles,
    scope,
    sessionIssuedAt: NOW,
  };
}

function orgSession(org = ORG_A, roles: SessionContext["roles"] = ["OWNER"]): SessionContext {
  return sessionFor({ kind: "org", organizationId: org }, roles);
}

function seedOperator(org: string, id: string, name: string, areaId = "area-1"): void {
  const operator: StoredOperator = {
    id,
    organizationId: org,
    areaId,
    name,
    phoneE164: "+628000000000",
    status: "ACTIVE",
    contractType: "FULL_TIME",
    trainingState: "TRAINED",
    createdAt: NOW,
    updatedAt: NOW,
    active: true,
  };
  memoryStore.operators.set(id, operator);
}

function seedStall(org: string, id: string, code: string, areaId = "area-1"): void {
  const stall: StoredStall = {
    id,
    organizationId: org,
    areaId,
    code,
    type: "GEROBAK",
    status: "ACTIVE",
    createdAt: NOW,
  };
  memoryStore.stalls.set(id, stall);
}

function seedShift(input: {
  org: string;
  id: string;
  stallId: string;
  operatorId: string;
  status?: StoredShift["status"];
  startedAt?: Date;
  businessDay?: string;
}): StoredShift {
  const shift: StoredShift = {
    id: input.id,
    organizationId: input.org,
    operatorId: input.operatorId,
    stallId: input.stallId,
    businessDay: input.businessDay ?? DAY,
    startedAt: input.startedAt ?? new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
    startLocationId: "loc-1",
    openingCashMinor: 50000,
    currency: "IDR",
    status: input.status ?? "OPEN",
    clientShiftId: `client-${input.id}`,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  memoryStore.shifts.set(shift.id, shift);
  return shift;
}

function seedSale(input: {
  org: string;
  id: string;
  stallId: string;
  shiftId: string;
  totalMinor: number;
  status?: StoredSale["status"];
  acceptedAt?: Date;
  businessDay?: string;
  operatorId?: string;
}): StoredSale {
  const acceptedAt = input.acceptedAt ?? NOW;
  const sale: StoredSale = {
    id: input.id,
    organizationId: input.org,
    shiftId: input.shiftId,
    sellingLocationId: "loc-1",
    operatorId: input.operatorId ?? "op-1",
    stallId: input.stallId,
    businessDay: input.businessDay ?? DAY,
    occurredAt: acceptedAt,
    serverAcceptedAt: acceptedAt,
    totalMinor: input.totalMinor,
    currency: "IDR",
    status: input.status ?? "COMPLETED",
    clientSaleId: `client-${input.id}`,
    version: 1,
    createdAt: acceptedAt,
  };
  memoryStore.sales.set(sale.id, sale);
  return sale;
}

function seedExpense(input: {
  org: string;
  id: string;
  shiftId: string;
  amountMinor: number;
  reviewStatus?: StoredExpense["reviewStatus"];
  flaggedReason?: string;
  paidFrom?: StoredExpense["paidFrom"];
  createdAt?: Date;
}): StoredExpense {
  const expense: StoredExpense = {
    id: input.id,
    organizationId: input.org,
    shiftId: input.shiftId,
    operatorId: "op-1",
    category: "PARKING",
    amountMinor: input.amountMinor,
    currency: "IDR",
    description: "parkir",
    paidFrom: input.paidFrom ?? "CASH_BOX",
    reviewStatus: input.reviewStatus ?? "SUBMITTED",
    flaggedReason: input.flaggedReason,
    clientExpenseId: `client-${input.id}`,
    incurredAt: input.createdAt ?? NOW,
    createdAt: input.createdAt ?? NOW,
  };
  memoryStore.expenses.set(expense.id, expense);
  return expense;
}

function seedReport(input: {
  org: string;
  id: string;
  shiftId: string;
  stallId: string;
  departedAt?: Date;
  arrivedAt?: Date;
}): StoredLocationReport {
  const report: StoredLocationReport = {
    id: input.id,
    organizationId: input.org,
    shiftId: input.shiftId,
    stallId: input.stallId,
    operatorId: "op-1",
    sellingLocationId: "loc-1",
    trigger: "ARRIVED",
    arrivedAt: input.arrivedAt ?? NOW,
    departedAt: input.departedAt,
    clientReportId: `client-${input.id}`,
    createdAt: NOW,
  };
  memoryStore.locationReports.set(report.id, report);
  return report;
}

function seedAudit(input: {
  org: string;
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  actorId?: string;
  reason?: string;
}): StoredAuditEvent {
  const event: StoredAuditEvent = {
    id: input.id,
    organizationId: input.org,
    actorId: input.actorId ?? "op-1",
    actorKind: "OPERATOR",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    occurredAt: input.occurredAt,
    reason: input.reason,
    requestId: `req-${input.id}`,
  };
  memoryStore.auditEvents.push(event);
  return event;
}

function seedAlert(input: {
  org: string;
  id: string;
  type: string;
  severity: StoredAlert["severity"];
  relatedEntityType?: string;
  relatedEntityId?: string;
  acknowledged?: boolean;
  createdAt?: Date;
}): StoredAlert {
  const alert: StoredAlert = {
    id: input.id,
    organizationId: input.org,
    type: input.type,
    severity: input.severity,
    message: "presentation text that must not leak into the read model",
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    acknowledged: input.acknowledged ?? false,
    createdAt: input.createdAt ?? NOW,
  };
  memoryStore.alerts.set(alert.id, alert);
  return alert;
}

/** Two stalls in org A (one per area), one stall in org B, each with a shift and money records. */
function seedTwoOrganizations(): {
  shiftA1: StoredShift;
  shiftA2: StoredShift;
  shiftB1: StoredShift;
} {
  seedOperator(ORG_A, "op-a1", "Budi", "area-1");
  seedOperator(ORG_A, "op-a2", "Sari", "area-2");
  seedOperator(ORG_B, "op-b1", "Other Tenant Operator", "area-9");
  seedStall(ORG_A, "stall-a1", "ST-A1", "area-1");
  seedStall(ORG_A, "stall-a2", "ST-A2", "area-2");
  seedStall(ORG_B, "stall-b1", "ST-B1", "area-9");

  const shiftA1 = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-a1" });
  const shiftA2 = seedShift({ org: ORG_A, id: "shift-a2", stallId: "stall-a2", operatorId: "op-a2" });
  const shiftB1 = seedShift({ org: ORG_B, id: "shift-b1", stallId: "stall-b1", operatorId: "op-b1" });

  seedSale({ org: ORG_A, id: "sale-a1", stallId: "stall-a1", shiftId: shiftA1.id, totalMinor: 15000 });
  seedSale({ org: ORG_A, id: "sale-a2", stallId: "stall-a2", shiftId: shiftA2.id, totalMinor: 20000 });
  seedSale({ org: ORG_B, id: "sale-b1", stallId: "stall-b1", shiftId: shiftB1.id, totalMinor: 999000 });

  seedExpense({ org: ORG_A, id: "exp-a1", shiftId: shiftA1.id, amountMinor: 5000 });
  seedExpense({ org: ORG_A, id: "exp-a2", shiftId: shiftA2.id, amountMinor: 2000 });
  seedExpense({ org: ORG_B, id: "exp-b1", shiftId: shiftB1.id, amountMinor: 111000 });

  seedReport({ org: ORG_A, id: "rep-a1", shiftId: shiftA1.id, stallId: "stall-a1" });
  seedReport({ org: ORG_A, id: "rep-a2", shiftId: shiftA2.id, stallId: "stall-a2" });
  seedReport({ org: ORG_B, id: "rep-b1", shiftId: shiftB1.id, stallId: "stall-b1" });

  seedAlert({ org: ORG_A, id: "alert-a1", type: "RESTOCK_REQUEST", severity: "INFO", relatedEntityType: "stall", relatedEntityId: "stall-a1" });
  seedAlert({ org: ORG_B, id: "alert-b1", type: "RESTOCK_REQUEST", severity: "CRITICAL", relatedEntityType: "stall", relatedEntityId: "stall-b1" });

  seedAudit({ org: ORG_A, id: "audit-a1", action: "sale.created", entityType: "sale", entityId: "sale-a1", occurredAt: new Date(NOW.getTime() - 60_000) });
  seedAudit({ org: ORG_A, id: "audit-a2", action: "shift.started", entityType: "shift", entityId: shiftA2.id, occurredAt: new Date(NOW.getTime() - 120_000) });
  seedAudit({ org: ORG_B, id: "audit-b1", action: "sale.created", entityType: "sale", entityId: "sale-b1", occurredAt: new Date(NOW.getTime() - 30_000) });

  return { shiftA1, shiftA2, shiftB1 };
}

describe("HQ dashboard read model (T-HQ-002 read layer)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("empty day: zeroed KPIs and a zero-filled trend, never fabricated values", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.kpis).toEqual({
      salesMinor: 0,
      transactionCount: 0,
      averageTransactionMinor: 0,
      expensesMinor: 0,
      expenseRatio: null,
      activeStalls: 0,
      totalStalls: 1,
    });
    expect(model.salesTrend).toHaveLength(24);
    expect(model.salesTrend.every((point) => point.amountMinor === 0 && point.transactionCount === 0)).toBe(true);
    expect(model.salesTrend[0]!.bucketStart).toBe(DAY_RANGE.start.toISOString());
    expect(model.recentActivity).toEqual([]);
    expect(model.alerts).toEqual([]);
    expect(model.currency).toBe("IDR");
    expect(model.businessDay).toBe(DAY);
    expect(model.generatedAt).toBe(NOW.toISOString());
    expect(model.freshnessBand).toBe("current");
  });

  it("aggregates COMPLETED sales only and excludes DRAFT and VOIDED records", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });
    seedSale({ org: ORG_A, id: "sale-1", stallId: "stall-a1", shiftId: shift.id, totalMinor: 15000 });
    seedSale({ org: ORG_A, id: "sale-2", stallId: "stall-a1", shiftId: shift.id, totalMinor: 20000 });
    seedSale({ org: ORG_A, id: "sale-draft", stallId: "stall-a1", shiftId: shift.id, totalMinor: 700000, status: "DRAFT" });
    seedSale({ org: ORG_A, id: "sale-void", stallId: "stall-a1", shiftId: shift.id, totalMinor: 900000, status: "VOIDED" });
    seedSale({ org: ORG_A, id: "sale-other-day", stallId: "stall-a1", shiftId: shift.id, totalMinor: 500000, businessDay: "2026-09-27" });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.kpis.salesMinor).toBe(35000);
    expect(model.kpis.transactionCount).toBe(2);
    expect(model.kpis.averageTransactionMinor).toBe(17500);
    expect(model.stalls[0]!.salesMinor).toBe(35000);
    expect(model.stalls[0]!.transactionCount).toBe(2);
  });

  it("aggregates expenses of the selected day through their shift", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });
    const otherDayShift = seedShift({ org: ORG_A, id: "shift-old", stallId: "stall-a1", operatorId: "op-1", businessDay: "2026-09-27" });
    seedExpense({ org: ORG_A, id: "exp-1", shiftId: shift.id, amountMinor: 5000 });
    seedExpense({ org: ORG_A, id: "exp-2", shiftId: shift.id, amountMinor: 2500, paidFrom: "PERSONAL" });
    seedExpense({ org: ORG_A, id: "exp-old", shiftId: otherDayShift.id, amountMinor: 800000 });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.kpis.expensesMinor).toBe(7500);
    expect(model.stalls[0]!.expensesMinor).toBe(7500);
  });

  it("expense ratio is null without sales and exact with sales; average never divides by zero", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });

    // Sales exist: ratio is expenses / sales.
    seedSale({ org: ORG_A, id: "sale-1", stallId: "stall-a1", shiftId: shift.id, totalMinor: 30000 });
    seedSale({ org: ORG_A, id: "sale-2", stallId: "stall-a1", shiftId: shift.id, totalMinor: 70000 });
    seedExpense({ org: ORG_A, id: "exp-1", shiftId: shift.id, amountMinor: 25000 });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });
    expect(model.kpis.salesMinor).toBe(100000);
    expect(model.kpis.expensesMinor).toBe(25000);
    expect(model.kpis.expenseRatio).toBe(0.25);
    expect(model.kpis.averageTransactionMinor).toBe(50000);

    // Expenses without sales: deterministic null ratio, no invented value.
    memoryStore.clear();
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift2 = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });
    seedExpense({ org: ORG_A, id: "exp-1", shiftId: shift2.id, amountMinor: 9000 });

    const emptySales = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });
    expect(emptySales.kpis.salesMinor).toBe(0);
    expect(emptySales.kpis.expensesMinor).toBe(9000);
    expect(emptySales.kpis.expenseRatio).toBeNull();
    expect(emptySales.kpis.averageTransactionMinor).toBe(0);
  });

  it("aggregates per stall and derives operational status from the session, not from sales", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    seedStall(ORG_A, "stall-a2", "ST-A2");
    seedStall(ORG_A, "stall-a3", "ST-A3");
    // A1 sold and closed; A2 has an open session without a single sale; A3 has no session at all.
    const closedShift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1", status: "CLOSED_ACCEPTED" });
    const activeShift = seedShift({ org: ORG_A, id: "shift-a2", stallId: "stall-a2", operatorId: "op-2" });
    seedSale({ org: ORG_A, id: "sale-a1", stallId: "stall-a1", shiftId: closedShift.id, totalMinor: 15000 });
    seedExpense({ org: ORG_A, id: "exp-a1", shiftId: closedShift.id, amountMinor: 1000 });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });
    const byId = new Map(model.stalls.map((stall) => [stall.stallId, stall]));

    expect(model.kpis.activeStalls).toBe(1);
    expect(model.kpis.totalStalls).toBe(3);
    expect(byId.get("stall-a1")).toMatchObject({ operationalStatus: "IDLE", salesMinor: 15000, expensesMinor: 1000 });
    expect(byId.get("stall-a2")).toMatchObject({
      operationalStatus: "ACTIVE",
      salesMinor: 0,
      activeShiftId: activeShift.id,
      activeShiftStatus: "OPEN",
    });
    expect(byId.get("stall-a3")).toMatchObject({ operationalStatus: "IDLE", salesMinor: 0, expensesMinor: 0 });
    // Deterministic ordering by business code, never by sales.
    expect(model.stalls.map((stall) => stall.code)).toEqual(["ST-A1", "ST-A2", "ST-A3"]);
  });

  it("scope isolation: an organization never sees another organization's stalls, money or activity", async () => {
    seedTwoOrganizations();
    const model = await getHqDashboardForSession({ session: orgSession(ORG_A), businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.filters).toEqual({ businessDay: DAY, scopeKind: "org", stallId: undefined });
    expect(model.kpis.salesMinor).toBe(35000);
    expect(model.kpis.expensesMinor).toBe(7000);
    expect(model.stalls.map((stall) => stall.stallId).sort()).toEqual(["stall-a1", "stall-a2"]);
    expect(model.alerts.map((alert) => alert.alertId)).toEqual(["alert-a1"]);
    expect(model.recentActivity.map((item) => item.activityId).sort()).toEqual(["audit-a1", "audit-a2"]);
    expect(JSON.stringify(model)).not.toContain("stall-b1");
    expect(JSON.stringify(model)).not.toContain("999000");

    const otherTenant = await getHqDashboardForSession({ session: orgSession(ORG_B), businessDay: DAY, clock: fixedClock(NOW) });
    expect(otherTenant.kpis.salesMinor).toBe(999000);
    expect(otherTenant.stalls.map((stall) => stall.stallId)).toEqual(["stall-b1"]);
    expect(JSON.stringify(otherTenant)).not.toContain("stall-a1");
  });

  it("area scope narrows the dashboard to the authorized area only", async () => {
    seedTwoOrganizations();
    const areaSession = sessionFor({ kind: "area", organizationId: ORG_A, areaId: "area-1" }, ["AREA_SUPERVISOR"]);

    const model = await getHqDashboardForSession({ session: areaSession, businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.filters.scopeKind).toBe("area");
    expect(model.kpis.salesMinor).toBe(15000);
    expect(model.kpis.activeStalls).toBe(1);
    expect(model.kpis.totalStalls).toBe(1);
    expect(model.stalls.map((stall) => stall.stallId)).toEqual(["stall-a1"]);
    // Activity and alerts from area-2 stalls are excluded (A2's shift event is not attributable).
    expect(model.recentActivity.map((item) => item.activityId)).toEqual(["audit-a1"]);
    expect(model.alerts.map((alert) => alert.alertId)).toEqual(["alert-a1"]);
    expect(JSON.stringify(model)).not.toContain("sale-a2");
  });

  it("outlet filter: authorized stall narrows everything, unknown is NOT_FOUND, unauthorized is FORBIDDEN", async () => {
    seedTwoOrganizations();

    const filtered = await getHqDashboardForSession({
      session: orgSession(ORG_A),
      businessDay: DAY,
      stallId: "stall-a2",
      clock: fixedClock(NOW),
    });
    expect(filtered.filters.stallId).toBe("stall-a2");
    expect(filtered.stalls.map((stall) => stall.stallId)).toEqual(["stall-a2"]);
    expect(filtered.kpis.salesMinor).toBe(20000);
    expect(filtered.kpis.expensesMinor).toBe(2000);
    expect(filtered.kpis.totalStalls).toBe(1);
    expect(filtered.salesTrend.reduce((sum, point) => sum + point.amountMinor, 0)).toBe(20000);

    // Unknown inside this organization -> NOT_FOUND.
    await expect(
      getHqDashboardForSession({ session: orgSession(ORG_A), businessDay: DAY, stallId: "stall-does-not-exist", clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Another organization's stall -> NOT_FOUND as well: existence across tenants is never revealed.
    await expect(
      getHqDashboardForSession({ session: orgSession(ORG_A), businessDay: DAY, stallId: "stall-b1", clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Existing stall outside an area supervisor's scope -> FORBIDDEN (denial, never a wider read).
    const areaSession = sessionFor({ kind: "area", organizationId: ORG_A, areaId: "area-1" }, ["AREA_SUPERVISOR"]);
    await expect(
      getHqDashboardForSession({ session: areaSession, businessDay: DAY, stallId: "stall-a2", clock: fixedClock(NOW) })
    ).rejects.toBeInstanceOf(HqDashboardError);
    await expect(
      getHqDashboardForSession({ session: areaSession, businessDay: DAY, stallId: "stall-a2", clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sales trend buckets hourly inside the business day, zero-filled and chronological", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });
    const start = DAY_RANGE.start.getTime();
    // +5h and +6h after the 04:00 Jakarta start; one record accepted after the window closes.
    seedSale({ org: ORG_A, id: "sale-1", stallId: "stall-a1", shiftId: shift.id, totalMinor: 15000, acceptedAt: new Date(start + 5 * 3600_000) });
    seedSale({ org: ORG_A, id: "sale-2", stallId: "stall-a1", shiftId: shift.id, totalMinor: 5000, acceptedAt: new Date(start + 6 * 3600_000 + 25 * 60_000) });
    seedSale({ org: ORG_A, id: "sale-3", stallId: "stall-a1", shiftId: shift.id, totalMinor: 7000, acceptedAt: new Date(start + 26 * 3600_000) });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });

    expect(model.salesTrend).toHaveLength(24);
    expect(model.salesTrend[5]).toEqual({
      bucketStart: new Date(start + 5 * 3600_000).toISOString(),
      amountMinor: 15000,
      transactionCount: 1,
    });
    expect(model.salesTrend[6]).toEqual({
      bucketStart: new Date(start + 6 * 3600_000).toISOString(),
      amountMinor: 5000,
      transactionCount: 1,
    });
    // Clamped to the last bucket so the trend always reconciles with the KPI total.
    expect(model.salesTrend[23]!.amountMinor).toBe(7000);
    expect(model.salesTrend[23]!.bucketStart).toBe(new Date(start + 23 * 3600_000).toISOString());
    // Chronological, no duplicate buckets, no buckets outside the business day.
    const starts = model.salesTrend.map((point) => point.bucketStart);
    expect([...starts].sort()).toEqual(starts);
    expect(new Set(starts).size).toBe(24);
    expect(starts[0]).toBe(DAY_RANGE.start.toISOString());
    expect(Date.parse(starts[23]!)).toBeLessThan(DAY_RANGE.end.getTime());
    const trendTotal = model.salesTrend.reduce((sum, point) => sum + point.amountMinor, 0);
    expect(trendTotal).toBe(model.kpis.salesMinor);
  });

  it("recent activity is newest first, bounded by the requested limit, and day-scoped", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    const shift = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1" });
    seedSale({ org: ORG_A, id: "sale-1", stallId: "stall-a1", shiftId: shift.id, totalMinor: 15000, acceptedAt: new Date(NOW.getTime() - 60 * 60 * 1000) });
    seedExpense({ org: ORG_A, id: "exp-1", shiftId: shift.id, amountMinor: 3000, createdAt: new Date(NOW.getTime() - 60_000) });
    seedAudit({ org: ORG_A, id: "event-old", action: "shift.started", entityType: "shift", entityId: shift.id, occurredAt: new Date(NOW.getTime() - 3 * 60 * 60 * 1000) });
    seedAudit({ org: ORG_A, id: "event-mid", action: "sale.created", entityType: "sale", entityId: "sale-1", occurredAt: new Date(NOW.getTime() - 60 * 60 * 1000) });
    seedAudit({ org: ORG_A, id: "event-new", action: "expense.submitted", entityType: "expense", entityId: "exp-1", occurredAt: new Date(NOW.getTime() - 60_000) });
    seedAudit({ org: ORG_A, id: "event-other-day", action: "sale.created", entityType: "sale", entityId: "sale-x", occurredAt: new Date(DAY_RANGE.start.getTime() - 60_000) });

    const limited = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, activityLimit: 2, clock: fixedClock(NOW) });
    expect(limited.recentActivity.map((item) => item.activityId)).toEqual(["event-new", "event-mid"]);
    expect(limited.recentActivity.map((item) => item.type)).toEqual(["expense.submitted", "sale.created"]);
    expect(limited.recentActivity[1]!.stallId).toBe("stall-a1");

    const defaulted = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });
    expect(defaulted.recentActivity.map((item) => item.activityId)).toEqual(["event-new", "event-mid", "event-old"]);
  });

  it("rejects an out-of-range activity limit instead of silently clamping", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    await expect(
      getHqDashboardForSession({ session: orgSession(), businessDay: DAY, activityLimit: 0, clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      getHqDashboardForSession({ session: orgSession(), businessDay: DAY, activityLimit: DASHBOARD_ACTIVITY_MAX_LIMIT + 1, clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      getHqDashboardForSession({ session: orgSession(), businessDay: "2026-13-45", clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("alerts: only deterministic rules fire, structured and scope-attributed", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    seedStall(ORG_A, "stall-a2", "ST-A2");
    seedStall(ORG_A, "stall-a3", "ST-A3");
    // A1: session 45 min old without a location report -> coverage alert.
    const shiftA1 = seedShift({ org: ORG_A, id: "shift-a1", stallId: "stall-a1", operatorId: "op-1", startedAt: new Date(NOW.getTime() - 45 * 60_000) });
    // A2: session of the same age but with an open location report -> no alert.
    const shiftA2 = seedShift({ org: ORG_A, id: "shift-a2", stallId: "stall-a2", operatorId: "op-2", startedAt: new Date(NOW.getTime() - 45 * 60_000) });
    seedReport({ org: ORG_A, id: "rep-a2", shiftId: shiftA2.id, stallId: "stall-a2" });
    // A3: young session -> no alert, and a flagged expense -> review alert.
    const shiftA3 = seedShift({ org: ORG_A, id: "shift-a3", stallId: "stall-a3", operatorId: "op-3", startedAt: new Date(NOW.getTime() - 5 * 60_000) });
    seedExpense({ org: ORG_A, id: "exp-flagged", shiftId: shiftA3.id, amountMinor: 250000, reviewStatus: "REVIEW_REQUIRED", flaggedReason: "HIGH_AMOUNT" });
    seedExpense({ org: ORG_A, id: "exp-clean", shiftId: shiftA3.id, amountMinor: 12000 });
    seedAlert({ org: ORG_A, id: "alert-persisted", type: "QUARANTINE", severity: "WARNING", relatedEntityType: "stall", relatedEntityId: "stall-a1" });
    seedAlert({ org: ORG_A, id: "alert-acked", type: "QUARANTINE", severity: "CRITICAL", relatedEntityType: "stall", relatedEntityId: "stall-a1", acknowledged: true });

    const model = await getHqDashboardForSession({ session: orgSession(), businessDay: DAY, clock: fixedClock(NOW) });
    const byId = new Map(model.alerts.map((alert) => [alert.alertId, alert]));

    expect(model.alerts).toHaveLength(3);
    expect(byId.has("alert-acked")).toBe(false);
    expect(byId.get("alert-persisted")).toMatchObject({ type: "QUARANTINE", severity: "warning", stallId: "stall-a1" });
    expect(byId.get(`shift_without_location_report:${shiftA1.id}`)).toMatchObject({
      type: "shift_without_location_report",
      severity: "warning",
      stallId: "stall-a1",
      shiftId: "shift-a1",
    });
    expect(byId.has(`shift_without_location_report:${shiftA2.id}`)).toBe(false);
    expect(byId.has(`shift_without_location_report:${shiftA3.id}`)).toBe(false);
    expect(byId.get("expense_review_required:exp-flagged")).toMatchObject({
      type: "expense_review_required",
      severity: "info",
      stallId: "stall-a3",
      metadata: { reviewStatus: "REVIEW_REQUIRED", flaggedReason: "HIGH_AMOUNT", amountMinor: 250000 },
    });
    expect(byId.has("expense_review_required:exp-clean")).toBe(false);
    // The stored presentation text never reaches the read model.
    expect(JSON.stringify(model.alerts)).not.toContain("presentation text");
    // Severity ordering is deterministic: warning before info.
    expect(model.alerts.map((alert) => alert.severity)).toEqual(["warning", "warning", "info"]);
  });

  it("authorization: a role without HQ read capability is denied before any aggregation", async () => {
    seedTwoOrganizations();
    const operatorSession = sessionFor(
      { kind: "self", organizationId: ORG_A, operatorId: "op-a1" },
      ["OPERATOR"],
      "user-operator"
    );

    await expect(
      getHqDashboardForSession({ session: operatorSession, businessDay: DAY, clock: fixedClock(NOW) })
    ).rejects.toMatchObject({ code: "FORBIDDEN", name: "HqDashboardError" });
  });

  it("the read model cannot be built from a hand-written scope object (compile-time brand)", async () => {
    seedStall(ORG_A, "stall-a1", "ST-A1");
    await expect(
      getHqDashboard({
        // @ts-expect-error AuthorizedHqScope only comes from authorizeHqScope() / getHqDashboardForSession().
        scope: { kind: "org", organizationId: ORG_A },
        businessDay: DAY,
        clock: fixedClock(NOW),
      })
    ).resolves.toBeTruthy();
  });

  it("unsupported scopes (region/self) are denied instead of falling back to the whole organization", async () => {
    seedTwoOrganizations();
    for (const scope of [
      { kind: "region", organizationId: ORG_A, regionId: "region-1" },
      { kind: "self", organizationId: ORG_A, operatorId: "op-a1" },
    ] as Scope[]) {
      const session = sessionFor(scope, ["OWNER"]);
      await expect(
        getHqDashboardForSession({ session, businessDay: DAY, clock: fixedClock(NOW) })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("HQ dashboard read model through real persistence (T-HQ-002)", () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it("persisted records -> scoped reader -> read model, through the real feature services", async () => {
    const operatorId = generateId();
    const stallId = generateId();
    const locationId = generateId();
    const menuItemId = generateId();
    seedOperator(ORG_A, operatorId, "Budi");
    seedStall(ORG_A, stallId, "ST-001");
    memoryStore.sellingLocations.set(locationId, {
      id: locationId,
      organizationId: ORG_A,
      areaId: "area-1",
      name: "Alun-alun",
      status: "AVAILABLE",
      createdAt: NOW,
      updatedAt: NOW,
    });
    memoryStore.menuItems.set(menuItemId, {
      id: menuItemId,
      organizationId: ORG_A,
      categoryId: "cat-1",
      name: "Siomay Ayam",
      active: true,
      sortOrder: 0,
      createdAt: NOW,
    });
    await publishPricePolicy({
      menuItemId,
      scope: "ORG",
      scopeId: ORG_A,
      unitPrice: money(15000, "IDR"),
      effectiveFrom: new Date(Date.now() - 24 * 3600 * 1000),
      reason: "test seed",
      createdBy: STAFF_USER,
      organizationId: ORG_A,
    });

    const started = await startShift({
      operatorId,
      stallId,
      sellingLocationId: locationId,
      openingCash: money(50000, "IDR"),
      startingStock: [],
      clientShiftId: generateId(),
      organizationId: ORG_A,
    });
    const sale = await createSale({
      shiftId: started.shiftId,
      lines: [{ menuItemId, quantity: 2 }],
      clientSaleId: generateId(),
      organizationId: ORG_A,
    });
    await createCashPayment({
      saleId: sale.saleId,
      amount: money(30000, "IDR"),
      cashReceived: money(50000, "IDR"),
      clientPaymentId: generateId(),
      organizationId: ORG_A,
    });
    await submitExpense({
      shiftId: started.shiftId,
      categoryCode: "PARKING",
      description: "parkir",
      amount: money(5000, "IDR"),
      paidFrom: "CASH_BOX",
      clientExpenseId: generateId(),
      organizationId: ORG_A,
    });

    // The live business day, derived server-side (never supplied by a device).
    const businessDay = toBusinessDay(new Date(), DEFAULT_BUSINESS_DAY_CONFIG);
    const model = await getHqDashboardForSession({ session: orgSession(ORG_A), businessDay });

    expect(model.kpis.salesMinor).toBe(30000);
    expect(model.kpis.transactionCount).toBe(1);
    expect(model.kpis.averageTransactionMinor).toBe(30000);
    expect(model.kpis.expensesMinor).toBe(5000);
    expect(model.kpis.expenseRatio).toBeCloseTo(5000 / 30000, 10);
    expect(model.kpis.activeStalls).toBe(1);
    expect(model.stalls[0]).toMatchObject({
      stallId,
      code: "ST-001",
      operationalStatus: "ACTIVE",
      operatorId,
      operatorName: "Budi",
      salesMinor: 30000,
      expensesMinor: 5000,
    });
    expect(model.stalls[0]!.startedAt).toBe(memoryStore.shifts.get(started.shiftId)!.startedAt.toISOString());
    expect(model.recentActivity.map((item) => item.type)).toEqual(
      expect.arrayContaining(["shift.started", "sale.created", "payment.recorded", "expense.submitted"])
    );

    // Persistence proof: the same records are on disk, not only in memory.
    const dbPath = path.join(process.cwd(), "data", "db.json");
    const onDisk = JSON.parse(fs.readFileSync(dbPath, "utf-8")) as { sales: [string, unknown][]; expenses: [string, unknown][] };
    expect(onDisk.sales.some(([id]) => id === sale.saleId)).toBe(true);
    expect(onDisk.expenses.some(([, value]) => (value as { shiftId: string }).shiftId === started.shiftId)).toBe(true);
  });
});
