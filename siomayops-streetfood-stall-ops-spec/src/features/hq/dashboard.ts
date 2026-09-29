/**
 * HQ dashboard read model — server-side aggregation only.
 *
 * Flow: file-backed store -> `openScopedReader` (scope-mandatory reads, INV-11/INV-14)
 *   -> `getHqDashboard()` (this module) -> `HqDashboardReadModel`.
 *
 * The model returns data, never presentation: integer minor units (ADR-0006), ISO-8601 UTC
 * instants, structured type codes and ids. Money formatting, wording and freshness badges belong
 * to the delivery layer. No API route or UI is wired to this module yet.
 *
 * Rules implemented here come from `HQ.md` §5, `docs/product/HQ-DASHBOARD.md`, `SALES.md` §2,
 * `EXPENSES.md`, `docs/operations/API-READ.md` §1 and ADR-0033 (server-derived business day).
 */
import { authorize, type SessionContext } from "../../server/auth/port";
import { openScopedReader, type ScopedReader } from "../../server/db/repository";
import { money } from "../../shared/money/money";
import {
  DEFAULT_BUSINESS_DAY_CONFIG,
  businessDayRange,
  systemClock,
  type BusinessDay,
  type Clock,
} from "../../shared/time";
import type { Scope, ScopeKind } from "../../shared/types/scope";
import type { ShiftStatus } from "../../domain/shift";

/** Activity feed size when the caller does not ask for a specific page (API-READ.md §1 default). */
export const DASHBOARD_ACTIVITY_DEFAULT_LIMIT = 25;
/** Hard cap for the activity feed (API-READ.md §1 maximum). */
export const DASHBOARD_ACTIVITY_MAX_LIMIT = 200;
/** Alerts are current conditions, not a paginated history: keep the highest-consequence subset. */
export const DASHBOARD_ALERT_LIMIT = 50;
/** "Shift open > 30 min without a report" — the only alert threshold documented today
 * (`docs/product/HQ-DASHBOARD.md` §6). No other threshold is invented here. */
export const SHIFT_LOCATION_REPORT_GRACE_MINUTES = 30;
/** The business day is 24 hours; buckets are hourly and zero-filled. */
const TREND_BUCKET_COUNT = 24;
/** A shift in one of these states is still an open accountability session (`SHIFTS.md`,
 * `STATE_MACHINE.md`: SUSPENDED can only return to OPEN, be closed or be voided). */
const ACTIVE_SESSION_STATUSES: readonly ShiftStatus[] = ["OPEN", "PENDING_SYNC", "SUSPENDED"];
const BUSINESS_DAY_CONFIG = DEFAULT_BUSINESS_DAY_CONFIG;

export type HqDashboardAlertSeverity = "info" | "warning" | "critical";
export type HqDashboardStallStatus = "ACTIVE" | "IDLE";
export type HqDashboardFreshnessBand = "current" | "recent" | "stale";

export interface HqDashboardKpis {
  /** Gross total of COMPLETED sales for the business day, integer minor units. */
  readonly salesMinor: number;
  readonly transactionCount: number;
  /** `Math.round(salesMinor / transactionCount)`; 0 when the day has no transactions. */
  readonly averageTransactionMinor: number;
  /** Field expenses attributed to the business day through their shift, integer minor units. */
  readonly expensesMinor: number;
  /** `expensesMinor / salesMinor`, null when the day has no sales. Dimensionless, never money. */
  readonly expenseRatio: number | null;
  /** Stalls with an open accountability session on the selected day. */
  readonly activeStalls: number;
  /** Stalls inside the authorized scope (and inside the outlet filter, when one is applied). */
  readonly totalStalls: number;
}

export interface SalesTrendPoint {
  /** ISO-8601 UTC instant of the hourly bucket start (business day starts at 04:00 Asia/Jakarta). */
  readonly bucketStart: string;
  readonly amountMinor: number;
  readonly transactionCount: number;
}

export interface StallSummary {
  readonly stallId: string;
  readonly code: string;
  readonly areaId: string;
  /** Registry value as persisted; not interpreted. */
  readonly registryStatus: string;
  /** ACTIVE only when an open session exists on the selected day — never inferred from sales. */
  readonly operationalStatus: HqDashboardStallStatus;
  readonly activeShiftId?: string;
  readonly activeShiftStatus?: ShiftStatus;
  readonly operatorId?: string;
  readonly operatorName?: string;
  readonly startedAt?: string;
  readonly salesMinor: number;
  readonly transactionCount: number;
  readonly expensesMinor: number;
}

export interface OperationalAlert {
  /** Deterministic id: the persisted alert id, or `<type>:<entityId>` for derived conditions. */
  readonly alertId: string;
  readonly type: string;
  readonly severity: HqDashboardAlertSeverity;
  readonly stallId?: string;
  readonly shiftId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ActivityItem {
  readonly activityId: string;
  readonly occurredAt: string;
  readonly type: string;
  readonly actorId?: string;
  readonly actorKind: string;
  readonly actorRole?: string;
  readonly entityType: string;
  readonly entityId: string;
  /** Resolved when the event subject can be attributed to a stall; absent otherwise. */
  readonly stallId?: string;
  readonly reason?: string;
}

export interface HqDashboardReadModel {
  /** ISO-8601 UTC instant this model was produced (FR-HQ-008: no aggregate without its age). */
  readonly generatedAt: string;
  readonly businessDay: BusinessDay;
  readonly currency: "IDR";
  readonly freshnessBand: HqDashboardFreshnessBand;
  readonly filters: {
    readonly businessDay: BusinessDay;
    readonly scopeKind: ScopeKind;
    /** Present only when an outlet/stall filter was applied. */
    readonly stallId?: string;
  };
  readonly kpis: HqDashboardKpis;
  readonly salesTrend: readonly SalesTrendPoint[];
  readonly stalls: readonly StallSummary[];
  readonly alerts: readonly OperationalAlert[];
  readonly recentActivity: readonly ActivityItem[];
}

/** Authorization scope that has already passed `authorizeHqScope()`; cannot be constructed literally. */
declare const AUTHORIZED_HQ_SCOPE: unique symbol;
export type AuthorizedHqScope = Scope & { readonly [AUTHORIZED_HQ_SCOPE]: "hq:dashboard" };

export type HqDashboardErrorCode = "VALIDATION_FAILED" | "NOT_FOUND" | "FORBIDDEN";

export class HqDashboardError extends Error {
  readonly code: HqDashboardErrorCode;
  constructor(code: HqDashboardErrorCode, message: string) {
    super(message);
    this.name = "HqDashboardError";
    this.code = code;
  }
}

export interface GetHqDashboardInput {
  /** Must come from `authorizeHqScope()`/`getHqDashboardForSession()`, never from a request body. */
  readonly scope: AuthorizedHqScope;
  readonly businessDay: BusinessDay;
  readonly stallId?: string;
  readonly activityLimit?: number;
  readonly clock?: Clock;
}

export interface GetHqDashboardForSessionInput {
  readonly session: SessionContext;
  readonly businessDay: BusinessDay;
  readonly stallId?: string;
  readonly activityLimit?: number;
  readonly clock?: Clock;
}

/**
 * Resolve the session's authorization scope into a dashboard-safe scope.
 *
 * Uses the existing `authorize()` port with the `hq:view` capability, so a role without HQ read
 * access (for example `OPERATOR`) is denied before any data is loaded. The returned scope is
 * branded: `getHqDashboard()` cannot be called with an arbitrary, hand-written scope object.
 */
export function authorizeHqScope(session: SessionContext): AuthorizedHqScope {
  if (session.scope.organizationId !== session.organizationId) {
    throw new HqDashboardError("FORBIDDEN", "Session scope does not belong to the session organization");
  }
  try {
    authorize(session, "hq:view", session.scope);
  } catch (error) {
    throw new HqDashboardError("FORBIDDEN", error instanceof Error ? error.message : "Forbidden");
  }
  return session.scope as AuthorizedHqScope;
}

/** Convenience entry point for the delivery layer: session in, authorized dashboard out. */
export async function getHqDashboardForSession(
  input: GetHqDashboardForSessionInput
): Promise<HqDashboardReadModel> {
  const scope = authorizeHqScope(input.session);
  return getHqDashboard({
    scope,
    businessDay: input.businessDay,
    stallId: input.stallId,
    activityLimit: input.activityLimit,
    clock: input.clock,
  });
}

export async function getHqDashboard(input: GetHqDashboardInput): Promise<HqDashboardReadModel> {
  const businessDay = input.businessDay;
  assertBusinessDay(businessDay);
  const activityLimit = resolveActivityLimit(input.activityLimit);
  const now = (input.clock ?? systemClock).now();
  const range = businessDayRange(businessDay, BUSINESS_DAY_CONFIG);
  const reader = openScopedReader(input.scope);
  const isOrgWide = reader.scopeKind === "org";

  const authorizedStalls = reader.listAuthorizedStalls();
  const authorizedStallIds = new Set(authorizedStalls.map((stall) => stall.id));
  const appliedStallId = resolveStallFilter(reader, authorizedStallIds, input.stallId);

  // ---- facts of the selected business day (one load per collection, no per-row reads) --------
  const shifts = restrictToStall(
    reader.listShifts({ businessDay }),
    appliedStallId,
    (shift) => shift.stallId
  );
  const shiftIds = shifts.map((shift) => shift.id);
  const shiftStallIndex = new Map<string, string>();
  for (const shift of shifts) shiftStallIndex.set(shift.id, shift.stallId);

  const activeShiftByStall = new Map<string, (typeof shifts)[number]>();
  for (const shift of shifts) {
    if (!ACTIVE_SESSION_STATUSES.includes(shift.status)) continue;
    const current = activeShiftByStall.get(shift.stallId);
    if (!current || shift.startedAt.getTime() > current.startedAt.getTime()) {
      activeShiftByStall.set(shift.stallId, shift);
    }
  }

  const sales = restrictToStall(
    reader.listSales({ businessDay }),
    appliedStallId,
    (sale) => sale.stallId
  );
  const completedSales = sales.filter((sale) => sale.status === "COMPLETED");
  const expenses = reader.listExpenses({ shiftIds });
  const locationReports = reader.listLocationReports({ shiftIds });
  const payments = reader.listPayments({ saleIds: sales.map((sale) => sale.id) });

  // ---- KPI aggregation -----------------------------------------------------------------------
  let salesMinor = 0;
  let expensesMinor = 0;
  const salesByStall = new Map<string, { amountMinor: number; count: number }>();
  const expensesByStall = new Map<string, number>();
  const trendAmounts = new Array<number>(TREND_BUCKET_COUNT).fill(0);
  const trendCounts = new Array<number>(TREND_BUCKET_COUNT).fill(0);
  const bucketMs = (range.end.getTime() - range.start.getTime()) / TREND_BUCKET_COUNT;

  for (const sale of completedSales) {
    salesMinor += sale.totalMinor;
    const perStall = salesByStall.get(sale.stallId);
    if (perStall) {
      perStall.amountMinor += sale.totalMinor;
      perStall.count += 1;
    } else {
      salesByStall.set(sale.stallId, { amountMinor: sale.totalMinor, count: 1 });
    }
    // Server acceptance time is the authoritative clock (ADR-0033); device `occurredAt` is metadata.
    const bucket = bucketIndexFor(sale.serverAcceptedAt ?? sale.createdAt, range.start.getTime(), bucketMs);
    if (bucket !== null) {
      trendAmounts[bucket] = (trendAmounts[bucket] ?? 0) + sale.totalMinor;
      trendCounts[bucket] = (trendCounts[bucket] ?? 0) + 1;
    }
  }

  for (const expense of expenses) {
    expensesMinor += expense.amountMinor;
    const stallId = shiftStallIndex.get(expense.shiftId);
    if (stallId !== undefined) {
      expensesByStall.set(stallId, (expensesByStall.get(stallId) ?? 0) + expense.amountMinor);
    }
  }

  // ---- per-stall summaries -------------------------------------------------------------------
  const operatorNames = new Map(
    reader
      .listOperators([...new Set([...activeShiftByStall.values()].map((shift) => shift.operatorId))])
      .map((operator) => [operator.id, operator.name])
  );

  const stalls: StallSummary[] = authorizedStalls
    .filter((stall) => appliedStallId === undefined || stall.id === appliedStallId)
    .map((stall) => {
      const activeShift = activeShiftByStall.get(stall.id);
      const perStall = salesByStall.get(stall.id);
      const summary: StallSummary = {
        stallId: stall.id,
        code: stall.code,
        areaId: stall.areaId,
        registryStatus: stall.status,
        operationalStatus: activeShift ? "ACTIVE" : "IDLE",
        activeShiftId: activeShift?.id,
        activeShiftStatus: activeShift?.status,
        operatorId: activeShift?.operatorId,
        operatorName: activeShift ? operatorNames.get(activeShift.operatorId) : undefined,
        startedAt: activeShift?.startedAt.toISOString(),
        salesMinor: money(perStall?.amountMinor ?? 0).amountMinor,
        transactionCount: perStall?.count ?? 0,
        expensesMinor: money(expensesByStall.get(stall.id) ?? 0).amountMinor,
      };
      return summary;
    })
    // Deterministic ordering by business code; deliberately not ranked by sales (HQ.md §8).
    .sort((a, b) => (a.code === b.code ? a.stallId.localeCompare(b.stallId) : a.code.localeCompare(b.code)));

  const salesTotalMinor = money(salesMinor).amountMinor;
  const expensesTotalMinor = money(expensesMinor).amountMinor;
  const transactionCount = completedSales.length;
  const kpis: HqDashboardKpis = {
    salesMinor: salesTotalMinor,
    transactionCount,
    averageTransactionMinor:
      transactionCount === 0 ? 0 : money(Math.round(salesTotalMinor / transactionCount)).amountMinor,
    expensesMinor: expensesTotalMinor,
    expenseRatio: salesTotalMinor === 0 ? null : expensesTotalMinor / salesTotalMinor,
    activeStalls: stalls.filter((stall) => stall.operationalStatus === "ACTIVE").length,
    totalStalls: stalls.length,
  };

  const salesTrend: SalesTrendPoint[] = Array.from({ length: TREND_BUCKET_COUNT }, (_, index) => ({
    bucketStart: new Date(range.start.getTime() + index * bucketMs).toISOString(),
    amountMinor: money(trendAmounts[index] ?? 0).amountMinor,
    transactionCount: trendCounts[index] ?? 0,
  }));

  // ---- alert sources -------------------------------------------------------------------------
  const entityStallIndex = new Map<string, string>();
  for (const shift of shifts) entityStallIndex.set(key("shift", shift.id), shift.stallId);
  for (const sale of sales) entityStallIndex.set(key("sale", sale.id), sale.stallId);
  for (const report of locationReports) entityStallIndex.set(key("location_report", report.id), report.stallId);
  for (const expense of expenses) {
    const stallId = shiftStallIndex.get(expense.shiftId);
    if (stallId !== undefined) entityStallIndex.set(key("expense", expense.id), stallId);
  }
  const saleStallIndex = new Map(sales.map((sale) => [sale.id, sale.stallId]));
  for (const payment of payments) {
    const stallId = saleStallIndex.get(payment.saleId);
    if (stallId !== undefined) entityStallIndex.set(key("payment", payment.id), stallId);
  }
  const resolveEntityStall = (entityType?: string, entityId?: string): string | undefined => {
    if (entityType === undefined || entityId === undefined) return undefined;
    if (entityType === "stall") return isOrgWide || authorizedStallIds.has(entityId) ? entityId : undefined;
    return entityStallIndex.get(key(entityType, entityId));
  };

  const alerts: OperationalAlert[] = [];

  // (1) Persisted alerts a human has not acknowledged yet (current condition, not day-scoped).
  for (const alert of reader.listAlerts()) {
    if (alert.acknowledged) continue;
    const stallId = resolveEntityStall(alert.relatedEntityType, alert.relatedEntityId);
    if (!inScope(stallId, isOrgWide, authorizedStallIds)) continue;
    alerts.push({
      alertId: alert.id,
      type: alert.type,
      severity: severityFromStored(alert.severity),
      stallId,
      entityType: alert.relatedEntityType,
      entityId: alert.relatedEntityId,
      createdAt: alert.createdAt.toISOString(),
    });
  }

  // (2) Shift open longer than the documented grace period without a current location report.
  const shiftsWithOpenReport = new Set<string>();
  for (const report of locationReports) {
    if (!report.departedAt) shiftsWithOpenReport.add(report.shiftId);
  }
  for (const shift of activeShiftByStall.values()) {
    const openMinutes = (now.getTime() - shift.startedAt.getTime()) / 60000;
    if (openMinutes <= SHIFT_LOCATION_REPORT_GRACE_MINUTES) continue;
    if (shiftsWithOpenReport.has(shift.id)) continue;
    alerts.push({
      alertId: `shift_without_location_report:${shift.id}`,
      type: "shift_without_location_report",
      severity: "warning", // catalogue severity ATTENTION
      stallId: shift.stallId,
      shiftId: shift.id,
      entityType: "shift",
      entityId: shift.id,
      createdAt: shift.startedAt.toISOString(),
      metadata: { businessDay, status: shift.status, openMinutes: Math.floor(openMinutes) },
    });
  }

  // (3) Expenses the domain flagged for human review inside the selected day.
  for (const expense of expenses) {
    const reviewStatus = expense.reviewStatus;
    if (reviewStatus !== "REVIEW_REQUIRED" && reviewStatus !== "ESCALATED") continue;
    alerts.push({
      alertId: `expense_review_required:${expense.id}`,
      type: "expense_review_required",
      severity: "info", // catalogue severity INFO: "Expense pattern flagged"
      stallId: shiftStallIndex.get(expense.shiftId),
      shiftId: expense.shiftId,
      entityType: "expense",
      entityId: expense.id,
      createdAt: expense.createdAt.toISOString(),
      metadata: {
        category: expense.category,
        amountMinor: expense.amountMinor,
        paidFrom: expense.paidFrom,
        reviewStatus,
        flaggedReason: expense.flaggedReason,
      },
    });
  }

  alerts.sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.alertId.localeCompare(b.alertId)
  );

  // ---- recent activity (audit stream, newest first, bounded) ----------------------------------
  const recentActivity: ActivityItem[] = [];
  const events = reader
    .listAuditEvents({ from: range.start, to: range.end })
    .slice()
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || a.id.localeCompare(b.id));
  for (const event of events) {
    if (recentActivity.length >= activityLimit) break;
    const stallId = resolveEntityStall(event.entityType, event.entityId);
    if (!inScope(stallId, isOrgWide, authorizedStallIds)) continue;
    recentActivity.push({
      activityId: event.id,
      occurredAt: event.occurredAt.toISOString(),
      type: event.action,
      actorId: event.actorId,
      actorKind: event.actorKind,
      actorRole: event.actorRole,
      entityType: event.entityType,
      entityId: event.entityId,
      stallId,
      reason: event.reason,
    });
  }

  return {
    generatedAt: now.toISOString(),
    businessDay,
    currency: "IDR",
    freshnessBand: freshnessBand(now, now),
    filters: {
      businessDay,
      scopeKind: reader.scopeKind,
      stallId: appliedStallId,
    },
    kpis,
    salesTrend,
    stalls,
    alerts: alerts.slice(0, DASHBOARD_ALERT_LIMIT),
    recentActivity,
  };
}

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

function key(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/** Keep only the rows of the filtered stall when an outlet filter is applied. */
function restrictToStall<T>(rows: readonly T[], stallId: string | undefined, stallOf: (row: T) => string): readonly T[] {
  if (stallId === undefined) return rows;
  return rows.filter((row) => stallOf(row) === stallId);
}

function inScope(
  stallId: string | undefined,
  isOrgWide: boolean,
  authorizedStallIds: ReadonlySet<string>
): boolean {
  if (isOrgWide) return true;
  return stallId !== undefined && authorizedStallIds.has(stallId);
}

function severityRank(severity: HqDashboardAlertSeverity): number {
  switch (severity) {
    case "critical":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function severityFromStored(severity: "INFO" | "WARNING" | "CRITICAL"): HqDashboardAlertSeverity {
  switch (severity) {
    case "CRITICAL":
      return "critical";
    case "WARNING":
      return "warning";
    default:
      return "info";
  }
}

/** Hourly bucket index, clamped into the business-day window for records the server attributed to
 * this day but accepted outside it (for example a shift running past the 04:00 cut-off), so the
 * trend always reconciles with the KPI total. Returns null for an unplaceable timestamp. */
function bucketIndexFor(instant: Date | undefined, startMs: number, bucketMs: number): number | null {
  if (!instant) return null;
  const offset = instant.getTime() - startMs;
  if (!Number.isFinite(offset)) return null;
  const raw = Math.floor(offset / bucketMs);
  if (raw < 0) return 0;
  if (raw >= TREND_BUCKET_COUNT) return TREND_BUCKET_COUNT - 1;
  return raw;
}

function assertBusinessDay(businessDay: string): void {
  if (typeof businessDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(businessDay)) {
    throw new HqDashboardError("VALIDATION_FAILED", `Invalid business day: ${String(businessDay)}`);
  }
  const parts = businessDay.split("-").map((part) => Number(part));
  const year = parts[0]!;
  const month = parts[1]!;
  const day = parts[2]!;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new HqDashboardError("VALIDATION_FAILED", `Invalid business day: ${businessDay}`);
  }
}

function resolveActivityLimit(limit: number | undefined): number {
  if (limit === undefined) return DASHBOARD_ACTIVITY_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > DASHBOARD_ACTIVITY_MAX_LIMIT) {
    throw new HqDashboardError(
      "VALIDATION_FAILED",
      `activityLimit must be an integer between 1 and ${DASHBOARD_ACTIVITY_MAX_LIMIT}`
    );
  }
  return limit;
}

/**
 * Optional outlet filter. The requested stall must exist inside the session organization
 * (otherwise NOT_FOUND — indistinguishable from another organization's stall) and must be inside
 * the authorized scope (otherwise FORBIDDEN: a denial, never a silent wider read).
 */
function resolveStallFilter(
  reader: ScopedReader,
  authorizedStallIds: ReadonlySet<string>,
  requestedStallId: string | undefined
): string | undefined {
  if (requestedStallId === undefined) return undefined;
  if (typeof requestedStallId !== "string" || requestedStallId.trim() === "") {
    throw new HqDashboardError("VALIDATION_FAILED", "stallId must be a non-empty string");
  }
  const stall = reader.findStallInOrganization(requestedStallId);
  if (!stall) {
    throw new HqDashboardError("NOT_FOUND", "Stall not found");
  }
  if (!authorizedStallIds.has(stall.id)) {
    throw new HqDashboardError("FORBIDDEN", "Stall is outside the authorized scope");
  }
  return stall.id;
}

function freshnessBand(computedAt: Date, now: Date): HqDashboardFreshnessBand {
  const ageMinutes = (now.getTime() - computedAt.getTime()) / 60000;
  if (ageMinutes < 5) return "current";
  if (ageMinutes < 60) return "recent";
  return "stale";
}
