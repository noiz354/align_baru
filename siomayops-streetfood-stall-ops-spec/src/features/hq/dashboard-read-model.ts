/**
 * SiomayOps — HQ dashboard read model (T-HQ-002 read models, consumed by T-HQ-003 cards).
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`.
 *
 * Rules this module exists to enforce:
 *  - the dashboard surface renders **only** from this model; no page, component or client
 *    bundle computes an operational figure (HQ-DASHBOARD.md §1 "nothing is computed inline");
 *  - every section carries `computedAt` + a freshness band, so a stale figure is labelled
 *    rather than silently presented as current (FR-HQ-008, HQ-DASHBOARD.md §3.1);
 *  - scope (organization + optional area + optional outlet/stall) is applied **here**, so a
 *    caller cannot obtain out-of-scope rows by filtering in the browser (HQ-DASHBOARD.md §3.4);
 *  - verified and unverified digital money are never merged into one revenue line
 *    (FR-PAYMENT-010, HQ-DASHBOARD.md §3.2);
 *  - no presentation strings. Types, codes and numbers only — Indonesian copy lives in
 *    `src/app/hq/_lib/copy.ts`.
 *
 * "Outlet" in the dashboard vocabulary is a stall/gerobak record (`StoredStall`), matching the
 * HQ coverage card ("who is selling, where, and who is not?").
 */

import { memoryStore, syncFromDiskIfNeeded } from "../../server/db/memory-store";
import type {
  StoredExpense,
  StoredPayment,
  StoredSale,
  StoredShift,
  StoredStall,
} from "../../server/db/memory-store";
import { money, type Money } from "../../shared/money/money";
import { businessDayRange, DEFAULT_BUSINESS_DAY_CONFIG, type BusinessDay } from "../../shared/time/business-day";

export type FreshnessBand = "current" | "recent" | "stale";

export interface DashboardSection<T> {
  /** ISO-8601 UTC. Serialisable across the server/client boundary. */
  readonly computedAt: string;
  readonly freshnessBand: FreshnessBand;
  readonly value: T;
}

export interface DashboardScope {
  readonly organizationId: string;
  readonly areaId: string | null;
  /** Outlet (= stall) filter, already validated against the caller's authorized scope. */
  readonly outletId: string | null;
}

export interface DashboardRequest {
  readonly organizationId: string;
  readonly areaId?: string;
  readonly outletId?: string;
  readonly businessDay: BusinessDay;
  /** Injectable for tests; defaults to the wall clock. */
  readonly now?: Date;
}

/**
 * Provisional pilot thresholds. Provenance:
 *  - `cashVarianceMinor`: default returned by `GET /api/v1/config/thresholds`.
 *  - `lowStockQty`: pilot default carried over from the previous dashboard's inline rule
 *    (`currentQty < 10`); it is NOT yet part of a shared configuration module — see
 *    "Known Gaps" in `docs/integration/05-hq-dashboard-ui-integration.md`.
 */
export const CASH_VARIANCE_TOLERANCE_MINOR = 10000;
export const LOW_STOCK_QTY = 10;

export type OutletStatus =
  | "NOT_STARTED"
  | "OPEN"
  | "SUSPENDED"
  | "CLOSING_SUBMITTED"
  | "CLOSED"
  | "VOID"
  | "INACTIVE";

export interface DashboardOutlet {
  /** Stall id (`StoredStall.id`). */
  readonly outletId: string;
  readonly code: string;
  readonly operatorName: string | null;
  /** ISO-8601 UTC of the most recent shift started for the business day, or null. */
  readonly shiftStartedAt: string | null;
  readonly status: OutletStatus;
  readonly sales: Money;
  readonly expenses: Money;
}

export interface DashboardKpis {
  /** Gross completed sales for the business day (all payment methods). */
  readonly salesToday: Money;
  readonly transactionCount: number;
  /** null when there is no transaction: an average of nothing is not Rp 0. */
  readonly averageTransaction: Money | null;
  readonly expenses: Money;
  /** Percent of sales, single rounding step. null when sales are zero. */
  readonly expenseRatioPercent: number | null;
  readonly activeOutlets: number;
  readonly totalOutlets: number;
  /**
   * Payment-method split. `digitalVerified` and `digitalUnverified` are separate lines and are
   * never summed into one "digital" figure.
   */
  readonly grossByMethod: {
    readonly cash: Money;
    readonly digitalVerified: Money;
    readonly digitalUnverified: Money;
  };
}

export interface SalesTrendPoint {
  /** ISO-8601 UTC start of the hourly bucket. */
  readonly bucketStart: string;
  /** Local hour in Asia/Jakarta (UTC+7), 0..23. The UI formats the axis label. */
  readonly hourLocal: number;
  readonly total: Money;
  readonly transactionCount: number;
}

export interface SalesTrend {
  /** Always the full business-day bucket set, in chronological order. */
  readonly points: readonly SalesTrendPoint[];
  /**
   * Completed sales whose `occurredAt` fell outside the business-day window (device clock skew).
   * They are counted in the KPI totals but cannot be placed on the axis — surfaced explicitly
   * rather than dropped or invented.
   */
  readonly unbucketedCount: number;
  readonly unbucketedTotal: Money;
}

export type DashboardAlertType =
  | "OUTLET_NOT_STARTED"
  | "SHIFT_WITHOUT_LOCATION_REPORT"
  | "UNVERIFIED_DIGITAL_PAYMENT"
  | "CASH_VARIANCE_BEYOND_TOLERANCE"
  | "UNRESOLVED_VERIFICATIONS_AT_CLOSING"
  | "EXPENSE_PATTERN_FLAGGED"
  | "INCIDENT_OPEN"
  | "STOCK_LOW"
  | "STOCK_OUT"
  | "RESTOCK_REQUEST"
  | "UNCLASSIFIED";

export type AlertSeverity = "INFO" | "ATTENTION" | "BLOCKING" | "SECURITY";

export interface DashboardAlert {
  /** Deterministic: one alert per (type, subject) pair, so re-renders cannot duplicate it. */
  readonly id: string;
  readonly type: DashboardAlertType;
  readonly severity: AlertSeverity;
  readonly subjectKind: "STALL" | "SHIFT" | "PAYMENT" | "EXPENSE" | "INCIDENT" | "STOCK_ITEM" | "OTHER";
  readonly subjectId: string;
  readonly outletId: string | null;
  /** ISO-8601 UTC of the evidence (shift start, payment creation, ...) when known. */
  readonly occurredAt: string | null;
  /** Structured context for the UI. No wording. */
  readonly context: {
    readonly amountMinor?: number;
    readonly ageHours?: number;
    readonly quantity?: number;
    readonly code?: string;
  };
  readonly source: "RULE" | "PERSISTED";
  /** Raw stored type when `source` is PERSISTED and the type is not modelled. */
  readonly sourceType?: string;
}

export interface ActivityEntry {
  readonly id: string;
  /** Audit action string, e.g. `sale.created`. Mapped to Indonesian copy in the UI layer. */
  readonly eventType: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly outletId: string | null;
  readonly occurredAt: string;
}

export interface CoverageSummary {
  readonly shiftsActive: number;
  readonly shiftsWithoutLocationReport: number;
  readonly stallsIdle: number;
}

export interface CashPositionSummary {
  readonly expectedCash: Money;
  readonly countedCash: Money;
  readonly varianceAmount: Money;
  readonly unresolvedVerificationsCount: number;
}

export interface VerificationSummary {
  readonly pendingCount: number;
  readonly pendingAmountUnverified: Money;
  readonly oldestAgeHours: number | null;
}

export interface StockSummary {
  readonly lowCount: number;
  readonly outCount: number;
  readonly items: readonly {
    readonly stockItemId: string;
    readonly code: string;
    readonly name: string;
    readonly quantity: number;
  }[];
}

export interface ExpenseReviewSummary {
  readonly pending: number;
  readonly flagged: number;
}

export interface IncidentSummary {
  readonly open: number;
  readonly critical: number;
}

export interface ClosingCompletenessSummary {
  readonly submitted: number;
  readonly missing: number;
}

export interface LocationUsageSummary {
  readonly activeLocations: number;
  readonly crowded: number;
}

export type ExceptionType = "PAYMENT_UNVERIFIED" | "EXPENSE_FLAGGED" | "INCIDENT_OPEN";

export interface DashboardException {
  readonly id: string;
  readonly type: ExceptionType;
  readonly subjectId: string;
  readonly outletId: string | null;
  readonly amountMinor?: number;
  readonly ageHours?: number;
}

export interface HqDashboardReadModel {
  readonly businessDay: BusinessDay;
  readonly businessDayStart: string;
  readonly businessDayEnd: string;
  readonly scope: DashboardScope;
  readonly kpis: DashboardSection<DashboardKpis>;
  readonly salesTrend: DashboardSection<SalesTrend>;
  readonly outlets: DashboardSection<readonly DashboardOutlet[]>;
  readonly alerts: DashboardSection<readonly DashboardAlert[]>;
  readonly recentActivity: DashboardSection<readonly ActivityEntry[]>;
  readonly coverage: DashboardSection<CoverageSummary>;
  readonly cashPosition: DashboardSection<CashPositionSummary>;
  readonly verificationBacklog: DashboardSection<VerificationSummary>;
  readonly stockStatus: DashboardSection<StockSummary>;
  readonly expenseReview: DashboardSection<ExpenseReviewSummary>;
  readonly incidents: DashboardSection<IncidentSummary>;
  readonly closingCompleteness: DashboardSection<ClosingCompletenessSummary>;
  readonly locationUsage: DashboardSection<LocationUsageSummary>;
  readonly exceptions: DashboardSection<readonly DashboardException[]>;
}

export const ACTIVITY_LIMIT = 20;
export const ALERT_LIMIT = 50;
/** 04:00 → 03:59 next day, hourly buckets (see `DEFAULT_BUSINESS_DAY_CONFIG`). */
const BUSINESS_DAY_HOURS = 24;

function freshnessBand(computedAt: Date, now: Date): FreshnessBand {
  const ageMinutes = (now.getTime() - computedAt.getTime()) / 60000;
  if (ageMinutes < 5) return "current";
  if (ageMinutes < 60) return "recent";
  return "stale";
}

function section<T>(value: T, now: Date): DashboardSection<T> {
  return {
    computedAt: now.toISOString(),
    freshnessBand: freshnessBand(now, now),
    value,
  };
}

function isActiveShift(shift: StoredShift): boolean {
  return shift.status === "OPEN" || shift.status === "PENDING_SYNC" || shift.status === "DRAFT_OFFLINE";
}

function hoursBetween(from: Date, to: Date): number {
  return Math.round(((to.getTime() - from.getTime()) / 3600000) * 10) / 10;
}

/** Authorized outlets (= stalls) for a scope. Also used to validate the outlet filter. */
export function listAuthorizedOutlets(request: Pick<DashboardRequest, "organizationId" | "areaId" | "outletId">): StoredStall[] {
  const stalls: StoredStall[] = [];
  for (const stall of memoryStore.stalls.values()) {
    if (stall.organizationId !== request.organizationId) continue;
    if (request.areaId && stall.areaId !== request.areaId) continue;
    if (request.outletId && stall.id !== request.outletId) continue;
    stalls.push(stall);
  }
  return stalls.sort((a, b) => a.code.localeCompare(b.code));
}

/** True when the outlet exists inside the caller's authorized scope (never loads other scopes). */
export function isAuthorizedOutlet(request: Pick<DashboardRequest, "organizationId" | "areaId">, outletId: string): boolean {
  return listAuthorizedOutlets({ ...request, outletId }).length === 1;
}

function exportableStatuses(): readonly string[] {
  return ["CLOSED_ACCEPTED", "CLOSED_RETURNED", "CLOSING_SUBMITTED"];
}

interface ScopedFacts {
  readonly outlets: readonly StoredStall[];
  readonly shifts: readonly StoredShift[];
  readonly sales: readonly StoredSale[];
  readonly expenses: readonly StoredExpense[];
}

function collectScopedFacts(request: DashboardRequest): ScopedFacts {
  const range = businessDayRange(request.businessDay, DEFAULT_BUSINESS_DAY_CONFIG);
  const outlets = listAuthorizedOutlets(request);
  const outletCodes = new Set(outlets.map((o) => o.id));
  const orgWide = !request.areaId && !request.outletId;

  const shifts = Array.from(memoryStore.shifts.values()).filter(
    (s) => s.organizationId === request.organizationId && s.businessDay === request.businessDay && outletCodes.has(s.stallId),
  );

  const shiftIds = new Set(shifts.map((s) => s.id));

  const sales = Array.from(memoryStore.sales.values()).filter(
    (s) => s.organizationId === request.organizationId && s.businessDay === request.businessDay && outletCodes.has(s.stallId),
  );

  // An expense belongs to a business day through its shift. Without a resolvable shift the
  // expense is attributed by its own timestamp, and only for an organization-wide view —
  // an area/outlet-scoped view must not show records it cannot attribute.
  const expenses = Array.from(memoryStore.expenses.values()).filter((e) => {
    if (e.organizationId !== request.organizationId) return false;
    const shift = memoryStore.shifts.get(e.shiftId);
    if (shift) {
      if (!shiftIds.has(shift.id)) return false;
      return true;
    }
    if (!orgWide) return false;
    return e.incurredAt >= range.start && e.incurredAt < range.end;
  });

  return { outlets, shifts, sales, expenses };
}

function expenseAmountMinor(facts: ScopedFacts): number {
  return facts.expenses.reduce((sum, e) => sum + e.amountMinor, 0);
}

function paymentsForSales(organizationId: string, sales: readonly StoredSale[]): StoredPayment[] {
  const saleIds = new Set(sales.map((s) => s.id));
  return Array.from(memoryStore.payments.values()).filter(
    (p) => p.organizationId === organizationId && saleIds.has(p.saleId),
  );
}

function buildKpis(organizationId: string, facts: ScopedFacts): DashboardKpis {
  const completed = facts.sales.filter((s) => s.status === "COMPLETED");
  const salesTotal = completed.reduce((sum, s) => sum + s.totalMinor, 0);
  const transactionCount = completed.length;
  const expensesTotal = expenseAmountMinor(facts);

  // The method split covers every payment recorded against the business day's sales — including
  // payments whose sale has not completed yet (an unverified QRIS leaves the sale in DRAFT). That
  // unverified money must stay visible as its own line and is never merged into the headline
  // figure (FR-PAYMENT-010, HQ-DASHBOARD.md §3.2).
  const payments = paymentsForSales(organizationId, facts.sales);
  let cashMinor = 0;
  let digitalVerifiedMinor = 0;
  let digitalUnverifiedMinor = 0;
  for (const payment of payments) {
    if (payment.status === "PAID" && payment.method === "CASH") cashMinor += payment.amountMinor;
    else if (payment.status === "PAID") digitalVerifiedMinor += payment.amountMinor;
    else if (payment.status === "PENDING_VERIFICATION") digitalUnverifiedMinor += payment.amountMinor;
  }

  const activeOutlets = facts.outlets.filter((outlet) =>
    facts.shifts.some((s) => s.stallId === outlet.id && isActiveShift(s)),
  ).length;

  return {
    salesToday: money(salesTotal, "IDR"),
    transactionCount,
    averageTransaction: transactionCount > 0 ? money(Math.round(salesTotal / transactionCount), "IDR") : null,
    expenses: money(expensesTotal, "IDR"),
    expenseRatioPercent: salesTotal > 0 ? Math.round((expensesTotal / salesTotal) * 100) : null,
    activeOutlets,
    totalOutlets: facts.outlets.filter((o) => o.status === "ACTIVE").length,
    grossByMethod: {
      cash: money(cashMinor, "IDR"),
      digitalVerified: money(digitalVerifiedMinor, "IDR"),
      digitalUnverified: money(digitalUnverifiedMinor, "IDR"),
    },
  };
}

function buildSalesTrend(request: DashboardRequest, facts: ScopedFacts): SalesTrend {
  const range = businessDayRange(request.businessDay, DEFAULT_BUSINESS_DAY_CONFIG);
  const bucketMs = 3600000;
  const totals = new Array<number>(BUSINESS_DAY_HOURS).fill(0);
  const counts = new Array<number>(BUSINESS_DAY_HOURS).fill(0);
  let unbucketedCount = 0;
  let unbucketedTotal = 0;

  for (const sale of facts.sales) {
    if (sale.status !== "COMPLETED") continue;
    const offset = sale.occurredAt.getTime() - range.start.getTime();
    const index = Math.floor(offset / bucketMs);
    if (index < 0 || index >= BUSINESS_DAY_HOURS) {
      unbucketedCount += 1;
      unbucketedTotal += sale.totalMinor;
      continue;
    }
    totals[index] = (totals[index] ?? 0) + sale.totalMinor;
    counts[index] = (counts[index] ?? 0) + 1;
  }

  const points: SalesTrendPoint[] = [];
  for (let i = 0; i < BUSINESS_DAY_HOURS; i += 1) {
    const bucketStart = new Date(range.start.getTime() + i * bucketMs);
    points.push({
      bucketStart: bucketStart.toISOString(),
      hourLocal: (bucketStart.getUTCHours() + 7) % 24,
      total: money(totals[i] ?? 0, "IDR"),
      transactionCount: counts[i] ?? 0,
    });
  }

  return { points, unbucketedCount, unbucketedTotal: money(unbucketedTotal, "IDR") };
}

function outletStatus(facts: ScopedFacts, outlet: StoredStall): OutletStatus {
  if (outlet.status !== "ACTIVE") return "INACTIVE";
  const shifts = facts.shifts
    .filter((s) => s.stallId === outlet.id)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  const latest = shifts[0];
  if (!latest) return "NOT_STARTED";
  switch (latest.status) {
    case "OPEN":
    case "PENDING_SYNC":
    case "DRAFT_OFFLINE":
      return "OPEN";
    case "SUSPENDED":
      return "SUSPENDED";
    case "CLOSING_SUBMITTED":
    case "CLOSED_RETURNED":
      return "CLOSING_SUBMITTED";
    case "CLOSED_ACCEPTED":
      return "CLOSED";
    case "VOID":
      return "VOID";
    default:
      return "NOT_STARTED";
  }
}

function buildOutlets(facts: ScopedFacts): DashboardOutlet[] {
  return facts.outlets.map((outlet) => {
    const shifts = facts.shifts.filter((s) => s.stallId === outlet.id);
    const latest = shifts.slice().sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
    const operator = latest ? memoryStore.operators.get(latest.operatorId) : undefined;
    const salesMinor = facts.sales
      .filter((s) => s.stallId === outlet.id && s.status === "COMPLETED")
      .reduce((sum, s) => sum + s.totalMinor, 0);
    const shiftIds = new Set(shifts.map((s) => s.id));
    const expensesMinor = facts.expenses
      .filter((e) => shiftIds.has(e.shiftId))
      .reduce((sum, e) => sum + e.amountMinor, 0);

    return {
      outletId: outlet.id,
      code: outlet.code,
      operatorName: operator?.name ?? null,
      shiftStartedAt: latest ? latest.startedAt.toISOString() : null,
      status: outletStatus(facts, outlet),
      sales: money(salesMinor, "IDR"),
      expenses: money(expensesMinor, "IDR"),
    };
  });
}

function activeLocationReportForShift(shiftId: string): boolean {
  for (const report of memoryStore.locationReports.values()) {
    if (report.shiftId === shiftId && !report.departedAt) return true;
  }
  return false;
}

function buildAlerts(request: DashboardRequest, facts: ScopedFacts, now: Date): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];
  const saleIds = new Set(facts.sales.map((s) => s.id));
  const shiftIds = new Set(facts.shifts.map((s) => s.id));

  // R1 — an authorized, active outlet with no shift for the business day.
  for (const outlet of facts.outlets) {
    if (outlet.status !== "ACTIVE") continue;
    if (facts.shifts.some((s) => s.stallId === outlet.id)) continue;
    alerts.push({
      id: `OUTLET_NOT_STARTED:${outlet.id}`,
      type: "OUTLET_NOT_STARTED",
      severity: "ATTENTION",
      subjectKind: "STALL",
      subjectId: outlet.id,
      outletId: outlet.id,
      occurredAt: null,
      context: { code: outlet.code },
      source: "RULE",
    });
  }

  // R2 — shift open without a location report (HQ-DASHBOARD.md §6 alert catalogue).
  for (const shift of facts.shifts) {
    if (!isActiveShift(shift)) continue;
    if (activeLocationReportForShift(shift.id)) continue;
    alerts.push({
      id: `SHIFT_WITHOUT_LOCATION_REPORT:${shift.id}`,
      type: "SHIFT_WITHOUT_LOCATION_REPORT",
      severity: "ATTENTION",
      subjectKind: "SHIFT",
      subjectId: shift.id,
      outletId: shift.stallId,
      occurredAt: shift.startedAt.toISOString(),
      context: { ageHours: hoursBetween(shift.startedAt, now) },
      source: "RULE",
    });
  }

  // R3 — digital money waiting on a human. No SLA is invented; the age is passed through.
  for (const payment of memoryStore.payments.values()) {
    if (payment.organizationId !== request.organizationId) continue;
    if (payment.status !== "PENDING_VERIFICATION") continue;
    if (!saleIds.has(payment.saleId)) continue;
    const sale = memoryStore.sales.get(payment.saleId);
    alerts.push({
      id: `UNVERIFIED_DIGITAL_PAYMENT:${payment.id}`,
      type: "UNVERIFIED_DIGITAL_PAYMENT",
      severity: "ATTENTION",
      subjectKind: "PAYMENT",
      subjectId: payment.id,
      outletId: sale?.stallId ?? null,
      occurredAt: payment.createdAt.toISOString(),
      context: { amountMinor: payment.amountMinor, ageHours: hoursBetween(payment.createdAt, now) },
      source: "RULE",
    });
  }

  // R4/R5 — closing-level rules, evaluated against the day's closings.
  for (const closing of memoryStore.closings.values()) {
    if (closing.organizationId !== request.organizationId) continue;
    if (!shiftIds.has(closing.shiftId)) continue;
    const shift = memoryStore.shifts.get(closing.shiftId);
    if (Math.abs(closing.cashVarianceMinor) > CASH_VARIANCE_TOLERANCE_MINOR) {
      alerts.push({
        id: `CASH_VARIANCE_BEYOND_TOLERANCE:${closing.id}`,
        type: "CASH_VARIANCE_BEYOND_TOLERANCE",
        severity: "ATTENTION",
        subjectKind: "SHIFT",
        subjectId: closing.shiftId,
        outletId: shift?.stallId ?? null,
        occurredAt: closing.submittedAt.toISOString(),
        context: { amountMinor: closing.cashVarianceMinor },
        source: "RULE",
      });
    }
    if (!exportableStatuses().includes(closing.status)) continue;
    const unresolved = Array.from(memoryStore.payments.values()).filter(
      (p) => p.organizationId === request.organizationId && p.status === "PENDING_VERIFICATION" && saleIds.has(p.saleId),
    ).length;
    if (unresolved > 0) {
      alerts.push({
        id: `UNRESOLVED_VERIFICATIONS_AT_CLOSING:${closing.id}`,
        type: "UNRESOLVED_VERIFICATIONS_AT_CLOSING",
        severity: "ATTENTION",
        subjectKind: "SHIFT",
        subjectId: closing.shiftId,
        outletId: shift?.stallId ?? null,
        occurredAt: closing.submittedAt.toISOString(),
        context: { quantity: unresolved },
        source: "RULE",
      });
    }
  }

  // R6 — an expense pattern flagged by policy, never an automatic consequence (EXPENSES.md).
  for (const expense of facts.expenses) {
    if (!expense.flaggedReason) continue;
    const shift = memoryStore.shifts.get(expense.shiftId);
    alerts.push({
      id: `EXPENSE_PATTERN_FLAGGED:${expense.id}`,
      type: "EXPENSE_PATTERN_FLAGGED",
      severity: "INFO",
      subjectKind: "EXPENSE",
      subjectId: expense.id,
      outletId: shift?.stallId ?? null,
      occurredAt: expense.incurredAt.toISOString(),
      context: { amountMinor: expense.amountMinor },
      source: "RULE",
    });
  }

  // R7 — open incidents (existing dashboard card semantics).
  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== request.organizationId) continue;
    if (incident.status === "CLOSED" || incident.status === "RESOLVED") continue;
    alerts.push({
      id: `INCIDENT_OPEN:${incident.id}`,
      type: "INCIDENT_OPEN",
      severity: "ATTENTION",
      subjectKind: "INCIDENT",
      subjectId: incident.id,
      outletId: null,
      occurredAt: incident.createdAt.toISOString(),
      context: {},
      source: "RULE",
    });
  }

  // R8 — stock position, derived with the same convention as `GET /api/v1/stock`.
  for (const summary of deriveStockSummary(request).items) {
    if (summary.quantity > 0) {
      if (summary.quantity >= LOW_STOCK_QTY) continue;
      alerts.push({
        id: `STOCK_LOW:${summary.stockItemId}`,
        type: "STOCK_LOW",
        severity: "INFO",
        subjectKind: "STOCK_ITEM",
        subjectId: summary.stockItemId,
        outletId: null,
        occurredAt: null,
        context: { quantity: summary.quantity, code: summary.code },
        source: "RULE",
      });
      continue;
    }
    alerts.push({
      id: `STOCK_OUT:${summary.stockItemId}`,
      type: "STOCK_OUT",
      severity: "ATTENTION",
      subjectKind: "STOCK_ITEM",
      subjectId: summary.stockItemId,
      outletId: null,
      occurredAt: null,
      context: { quantity: summary.quantity, code: summary.code },
      source: "RULE",
    });
  }

  // R9 — alerts raised by other features and persisted in the store. The stored `message` is
  // deliberately NOT passed through: wording belongs to the UI layer.
  for (const stored of memoryStore.alerts.values()) {
    if (stored.organizationId !== request.organizationId) continue;
    if (stored.acknowledged) continue;
    const outletId = stored.relatedEntityType === "stall" ? stored.relatedEntityId ?? null : null;
    if (request.outletId && outletId !== request.outletId) continue;
    const known = stored.type === "RESTOCK_REQUEST";
    alerts.push({
      id: `PERSISTED:${stored.id}`,
      type: known ? "RESTOCK_REQUEST" : "UNCLASSIFIED",
      severity: stored.severity === "CRITICAL" ? "BLOCKING" : stored.severity === "WARNING" ? "ATTENTION" : "INFO",
      subjectKind: "OTHER",
      subjectId: stored.relatedEntityId ?? stored.id,
      outletId,
      occurredAt: stored.createdAt.toISOString(),
      context: {},
      source: "PERSISTED",
      sourceType: stored.type,
    });
  }

  const severityRank: Record<AlertSeverity, number> = { BLOCKING: 0, SECURITY: 1, ATTENTION: 2, INFO: 3 };
  return alerts
    .sort((a, b) => {
      const rank = severityRank[a.severity] - severityRank[b.severity];
      if (rank !== 0) return rank;
      return (b.occurredAt ?? "").localeCompare(a.occurredAt ?? "");
    })
    .slice(0, ALERT_LIMIT);
}

function resolveOutletIdForSubject(subjectKind: string, subjectId: string): string | null {
  switch (subjectKind) {
    case "shift":
      return memoryStore.shifts.get(subjectId)?.stallId ?? null;
    case "sale":
      return memoryStore.sales.get(subjectId)?.stallId ?? null;
    case "payment": {
      const payment = memoryStore.payments.get(subjectId);
      if (!payment) return null;
      return memoryStore.sales.get(payment.saleId)?.stallId ?? null;
    }
    case "stock_movement":
      return memoryStore.stockMovements.get(subjectId)?.stallId ?? null;
    case "expense": {
      const expense = memoryStore.expenses.get(subjectId);
      if (!expense) return null;
      return memoryStore.shifts.get(expense.shiftId)?.stallId ?? null;
    }
    case "closing": {
      const closing = memoryStore.closings.get(subjectId);
      if (!closing) return null;
      return memoryStore.shifts.get(closing.shiftId)?.stallId ?? null;
    }
    default:
      return null;
  }
}

function buildActivity(request: DashboardRequest, facts: ScopedFacts): ActivityEntry[] {
  const range = businessDayRange(request.businessDay, DEFAULT_BUSINESS_DAY_CONFIG);
  const outletIds = new Set(facts.outlets.map((o) => o.id));
  const entries: ActivityEntry[] = [];
  for (const event of memoryStore.auditEvents) {
    if (event.organizationId !== request.organizationId) continue;
    // The feed answers "what happened on this business day?" — an event outside the window
    // belongs to another day's dashboard, not to this one.
    if (event.occurredAt < range.start || event.occurredAt >= range.end) continue;
    const outletId = resolveOutletIdForSubject(event.entityType, event.entityId);
    if (outletId && !outletIds.has(outletId)) continue;
    // A single-outlet view only shows events it can attribute to that outlet.
    if (request.outletId && outletId !== request.outletId) continue;
    entries.push({
      id: event.id,
      eventType: event.action,
      subjectKind: event.entityType,
      subjectId: event.entityId,
      outletId,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
  return entries
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, ACTIVITY_LIMIT);
}

/**
 * Current stock quantity per item for the organization, using the same convention as
 * `GET /api/v1/stock` (sum of movement quantities). See "Known Gaps" in
 * `docs/integration/05-hq-dashboard-ui-integration.md` for the divergence from
 * `deriveStockPosition`.
 */
function deriveStockSummary(request: Pick<DashboardRequest, "organizationId">): StockSummary {
  const items: { stockItemId: string; code: string; name: string; quantity: number }[] = [];
  for (const item of memoryStore.stockItems.values()) {
    if (item.organizationId !== request.organizationId) continue;
    if (!item.active) continue;
    let quantity = 0;
    for (const movement of memoryStore.stockMovements.values()) {
      if (movement.organizationId !== request.organizationId) continue;
      if (movement.stockItemId !== item.id) continue;
      quantity += movement.quantity;
    }
    items.push({ stockItemId: item.id, code: item.code, name: item.name, quantity });
  }
  items.sort((a, b) => a.code.localeCompare(b.code));
  return {
    lowCount: items.filter((i) => i.quantity > 0 && i.quantity < LOW_STOCK_QTY).length,
    outCount: items.filter((i) => i.quantity <= 0).length,
    items,
  };
}

function buildCoverage(facts: ScopedFacts): CoverageSummary {
  const active = facts.shifts.filter(isActiveShift);
  const withoutReport = active.filter((s) => !activeLocationReportForShift(s.id)).length;
  const idle = facts.outlets.filter(
    (outlet) => !facts.shifts.some((s) => s.stallId === outlet.id && isActiveShift(s)),
  ).length;
  return { shiftsActive: active.length, shiftsWithoutLocationReport: withoutReport, stallsIdle: idle };
}

function buildCashPosition(request: DashboardRequest, facts: ScopedFacts): CashPositionSummary {
  const shiftIds = new Set(facts.shifts.map((s) => s.id));
  let expected = 0;
  let counted = 0;
  for (const closing of memoryStore.closings.values()) {
    if (closing.organizationId !== request.organizationId) continue;
    if (!shiftIds.has(closing.shiftId)) continue;
    expected += closing.expectedCashMinor;
    counted += closing.countedCashMinor;
  }
  let unresolved = 0;
  for (const payment of memoryStore.payments.values()) {
    if (payment.organizationId !== request.organizationId) continue;
    if (payment.status === "PENDING_VERIFICATION") unresolved += 1;
  }
  return {
    expectedCash: money(expected, "IDR"),
    countedCash: money(counted, "IDR"),
    varianceAmount: money(counted - expected, "IDR"),
    unresolvedVerificationsCount: unresolved,
  };
}

function buildVerification(request: DashboardRequest, facts: ScopedFacts, now: Date): VerificationSummary {
  const saleIds = new Set(facts.sales.map((s) => s.id));
  let count = 0;
  let amount = 0;
  let oldest: Date | null = null;
  for (const payment of memoryStore.payments.values()) {
    if (payment.organizationId !== request.organizationId) continue;
    if (payment.status !== "PENDING_VERIFICATION") continue;
    if (!saleIds.has(payment.saleId)) continue;
    count += 1;
    amount += payment.amountMinor;
    if (!oldest || payment.createdAt < oldest) oldest = payment.createdAt;
  }
  return {
    pendingCount: count,
    pendingAmountUnverified: money(amount, "IDR"),
    oldestAgeHours: oldest ? hoursBetween(oldest, now) : null,
  };
}

function buildExpenseReview(facts: ScopedFacts): ExpenseReviewSummary {
  let pending = 0;
  let flagged = 0;
  for (const expense of facts.expenses) {
    if (expense.reviewStatus === "SUBMITTED" || expense.reviewStatus === "REVIEW_REQUIRED") pending += 1;
    if (expense.flaggedReason) flagged += 1;
  }
  return { pending, flagged };
}

function buildIncidents(request: Pick<DashboardRequest, "organizationId">): IncidentSummary {
  let open = 0;
  let critical = 0;
  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== request.organizationId) continue;
    if (incident.status === "CLOSED" || incident.status === "RESOLVED") continue;
    open += 1;
    if (incident.status === "ESCALATED") critical += 1;
  }
  return { open, critical };
}

function buildClosingCompleteness(facts: ScopedFacts): ClosingCompletenessSummary {
  const submitted = facts.shifts.filter(
    (s) => s.status === "CLOSING_SUBMITTED" || s.status === "CLOSED_ACCEPTED" || s.status === "CLOSED_RETURNED",
  ).length;
  return { submitted, missing: Math.max(0, facts.shifts.length - submitted) };
}

function buildLocationUsage(request: Pick<DashboardRequest, "organizationId" | "areaId">): LocationUsageSummary {
  let active = 0;
  let crowded = 0;
  for (const location of memoryStore.sellingLocations.values()) {
    if (location.organizationId !== request.organizationId) continue;
    if (request.areaId && location.areaId !== request.areaId) continue;
    if (location.status === "ACTIVE") active += 1;
    if (location.status === "CROWDED") crowded += 1;
  }
  return { activeLocations: active, crowded };
}

function buildExceptions(request: DashboardRequest, facts: ScopedFacts, now: Date): DashboardException[] {
  const exceptions: DashboardException[] = [];
  const saleIds = new Set(facts.sales.map((s) => s.id));

  for (const payment of memoryStore.payments.values()) {
    if (payment.organizationId !== request.organizationId) continue;
    if (payment.status !== "PENDING_VERIFICATION") continue;
    if (!saleIds.has(payment.saleId)) continue;
    const sale = memoryStore.sales.get(payment.saleId);
    if (request.outletId && sale?.stallId !== request.outletId) continue;
    exceptions.push({
      id: `PAYMENT_UNVERIFIED:${payment.id}`,
      type: "PAYMENT_UNVERIFIED",
      subjectId: payment.id,
      outletId: sale?.stallId ?? null,
      amountMinor: payment.amountMinor,
      ageHours: hoursBetween(payment.createdAt, now),
    });
  }

  for (const expense of facts.expenses) {
    if (!expense.flaggedReason) continue;
    const shift = memoryStore.shifts.get(expense.shiftId);
    exceptions.push({
      id: `EXPENSE_FLAGGED:${expense.id}`,
      type: "EXPENSE_FLAGGED",
      subjectId: expense.id,
      outletId: shift?.stallId ?? null,
      amountMinor: expense.amountMinor,
    });
  }

  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== request.organizationId) continue;
    if (incident.status === "CLOSED" || incident.status === "RESOLVED") continue;
    exceptions.push({
      id: `INCIDENT_OPEN:${incident.id}`,
      type: "INCIDENT_OPEN",
      subjectId: incident.id,
      outletId: null,
      ageHours: hoursBetween(incident.createdAt, now),
    });
  }

  return exceptions;
}

/**
 * The dashboard read model. Call through the authenticated server boundary
 * (`src/server/dashboard/boundary.ts`) — never from a browser bundle.
 */
export function getHqDashboardReadModel(request: DashboardRequest): HqDashboardReadModel {
  syncFromDiskIfNeeded();
  const now = request.now ?? new Date();
  const range = businessDayRange(request.businessDay, DEFAULT_BUSINESS_DAY_CONFIG);
  const facts = collectScopedFacts(request);
  const stock = deriveStockSummary(request);

  return {
    businessDay: request.businessDay,
    businessDayStart: range.start.toISOString(),
    businessDayEnd: range.end.toISOString(),
    scope: {
      organizationId: request.organizationId,
      areaId: request.areaId ?? null,
      outletId: request.outletId ?? null,
    },
    kpis: section(buildKpis(request.organizationId, facts), now),
    salesTrend: section(buildSalesTrend(request, facts), now),
    outlets: section(buildOutlets(facts), now),
    alerts: section(buildAlerts(request, facts, now), now),
    recentActivity: section(buildActivity(request, facts), now),
    coverage: section(buildCoverage(facts), now),
    cashPosition: section(buildCashPosition(request, facts), now),
    verificationBacklog: section(buildVerification(request, facts, now), now),
    stockStatus: section(stock, now),
    expenseReview: section(buildExpenseReview(facts), now),
    incidents: section(buildIncidents(request), now),
    closingCompleteness: section(buildClosingCompleteness(facts), now),
    locationUsage: section(buildLocationUsage(request), now),
    exceptions: section(buildExceptions(request, facts, now), now),
  };
}
