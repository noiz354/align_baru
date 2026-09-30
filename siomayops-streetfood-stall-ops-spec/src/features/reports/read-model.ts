import { getDefaultDashboardDay, getHqDashboard, HqDashboardNotFoundError } from "@/features/hq/dashboard";
import { memoryStore } from "@/server/db/memory-store";
import { DEFAULT_BUSINESS_DAY_CONFIG, toBusinessDay, type BusinessDay } from "@/shared/time/business-day";
import type { Scope } from "@/shared/types/scope";

export const MAX_REPORT_DAYS = 31;
export const MAX_REPORT_OUTLETS = 5_000;
export const MAX_REPORT_PAGE_SIZE = 100;

export class ReportQueryError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string) { super(message); this.name = "ReportQueryError"; }
}

export class ReportDatasetTooLargeError extends Error {
  readonly code = "REPORT_TOO_LARGE";
  constructor() { super("The report exceeds the supported outlet limit"); this.name = "ReportDatasetTooLargeError"; }
}

export interface OperationalReportInput {
  readonly scope: Scope;
  readonly dateFrom?: BusinessDay;
  readonly dateTo?: BusinessDay;
  readonly areaId?: string;
  readonly outletId?: string;
  readonly cursor?: string;
  readonly limit?: number;
  readonly now?: Date;
}

export interface ReportSeriesPoint {
  readonly businessDay: BusinessDay;
  readonly salesMinor: number;
  readonly completedTransactions: number;
  readonly cashPaidMinor: number;
  readonly digitalVerifiedMinor: number;
  readonly digitalUnverifiedMinor: number;
  readonly reportedExpensesMinor: number;
  readonly salesAfterExpensesMinor: number;
  readonly incidentCount: number;
}

export interface ReportOutletRow {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly salesMinor: number;
  readonly completedTransactions: number;
  readonly averageTransactionMinor: number;
  readonly cashPaidMinor: number;
  readonly digitalVerifiedMinor: number;
  readonly digitalUnverifiedMinor: number;
  readonly reportedExpensesMinor: number;
  readonly salesAfterExpensesMinor: number;
  readonly incidentCount: number;
}

interface MutableTotals {
  salesMinor: number;
  completedTransactions: number;
  cashPaidMinor: number;
  digitalVerifiedMinor: number;
  digitalUnverifiedMinor: number;
  reportedExpensesMinor: number;
  incidentCount: number;
}

function validBusinessDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function shiftDay(day: BusinessDay, offset: number): BusinessDay {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, date! + offset, 12));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

function dayList(from: BusinessDay, to: BusinessDay): BusinessDay[] {
  const [fromYear, fromMonth, fromDate] = from.split("-").map(Number);
  const [toYear, toMonth, toDate] = to.split("-").map(Number);
  const start = Date.UTC(fromYear!, fromMonth! - 1, fromDate!, 12);
  const end = Date.UTC(toYear!, toMonth! - 1, toDate!, 12);
  const count = Math.floor((end - start) / 86_400_000) + 1;
  return Array.from({ length: count }, (_, index) => shiftDay(from, index));
}

function emptyTotals(): MutableTotals {
  return { salesMinor: 0, completedTransactions: 0, cashPaidMinor: 0, digitalVerifiedMinor: 0, digitalUnverifiedMinor: 0, reportedExpensesMinor: 0, incidentCount: 0 };
}

function latestDate(current: Date | null, candidate: Date | undefined): Date | null {
  if (!(candidate instanceof Date) || !Number.isFinite(candidate.getTime())) return current;
  return !current || candidate > current ? candidate : current;
}

function saleMatchesScope(sale: { organizationId: string; shiftId: string; stallId: string }, input: OperationalReportInput): boolean {
  const shift = memoryStore.shifts.get(sale.shiftId);
  if (!shift || shift.organizationId !== input.scope.organizationId || shift.organizationId !== sale.organizationId || shift.stallId !== sale.stallId) return false;
  if (input.scope.kind === "area") return memoryStore.stalls.get(shift.stallId)?.areaId === input.scope.areaId;
  if (input.scope.kind === "stall") return shift.stallId === input.scope.stallId;
  if (input.scope.kind === "self") return shift.operatorId === input.scope.operatorId;
  if (input.scope.kind === "region") return false;
  return true;
}

function applyScopeToIncident(incident: { organizationId: string; shiftId?: string }, input: OperationalReportInput, visibleLocationIds: Set<string>): { include: boolean; outletId: string | null; unattributed: boolean } {
  if (!incident.shiftId) {
    return { include: input.scope.kind === "org" && !input.areaId && !input.outletId, outletId: null, unattributed: true };
  }
  const shift = memoryStore.shifts.get(incident.shiftId);
  if (!shift || shift.organizationId !== incident.organizationId || shift.organizationId !== input.scope.organizationId) {
    return { include: false, outletId: null, unattributed: false };
  }
  const stall = memoryStore.stalls.get(shift.stallId);
  if (input.scope.kind === "area" && (!input.scope.areaId || stall?.areaId !== input.scope.areaId)) return { include: false, outletId: null, unattributed: false };
  if (input.scope.kind === "stall" && shift.stallId !== input.scope.stallId) return { include: false, outletId: null, unattributed: false };
  if (input.scope.kind === "self" && shift.operatorId !== input.scope.operatorId) return { include: false, outletId: null, unattributed: false };
  if (input.scope.kind === "region") return { include: false, outletId: null, unattributed: false };
  const outletId = shift.startLocationId;
  const matchesOutlet = visibleLocationIds.has(outletId) && (!input.outletId || input.outletId === outletId);
  const matchesArea = !input.areaId || memoryStore.sellingLocations.get(outletId)?.areaId === input.areaId;
  return { include: matchesOutlet && matchesArea, outletId, unattributed: false };
}

/**
 * Builds a bounded, deterministic report from persisted source records. Reports are human-facing
 * summaries only; they do not alter money records or act as accounting decisions.
 */
export function getOperationalReport(input: OperationalReportInput) {
  const now = input.now ?? new Date();
  const defaultTo = getDefaultDashboardDay(now);
  if ((input.dateFrom === undefined) !== (input.dateTo === undefined)) {
    throw new ReportQueryError("Both start and end business days must be supplied together");
  }
  const dateFrom = input.dateFrom ?? shiftDay(defaultTo, -(MAX_REPORT_DAYS - 1));
  const dateTo = input.dateTo ?? defaultTo;
  if (!validBusinessDay(dateFrom) || !validBusinessDay(dateTo) || dateFrom > dateTo) {
    throw new ReportQueryError("A valid, ordered business-day range is required");
  }
  const days = dayList(dateFrom, dateTo);
  if (days.length > MAX_REPORT_DAYS) throw new ReportQueryError(`Date range must not exceed ${MAX_REPORT_DAYS} business days`);
  const limit = input.limit ?? 25;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPORT_OUTLETS) {
    throw new ReportQueryError("Report limit is outside the supported range");
  }
  if (input.cursor && input.cursor.length > 160) throw new ReportQueryError("Report cursor is invalid");

  // Reuse the established dashboard scope resolver. It validates requested area/outlet IDs against
  // the authenticated scope and supplies only visible location options.
  const scopeAnchor = getHqDashboard({
    scope: input.scope,
    businessDay: dateFrom,
    areaId: input.areaId,
    outletId: input.outletId,
    limit: 1,
  });
  const visibleLocations = scopeAnchor.outletOptions
    .filter((location) => !input.outletId || location.id === input.outletId)
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID") || a.id.localeCompare(b.id));
  if (visibleLocations.length > MAX_REPORT_OUTLETS) throw new ReportDatasetTooLargeError();
  const visibleById = new Map(visibleLocations.map((location) => [location.id, location]));
  const visibleIds = new Set(visibleById.keys());

  const daily = new Map<BusinessDay, MutableTotals>(days.map((day) => [day, emptyTotals()]));
  const byOutlet = new Map<string, MutableTotals>(visibleLocations.map((location) => [location.id, emptyTotals()]));
  const completedSaleIds = new Set<string>();
  const saleLocationById = new Map<string, string>();
  let sourceWatermark: Date | null = null;

  for (const sale of memoryStore.sales.values()) {
    if (sale.organizationId !== input.scope.organizationId || sale.status !== "COMPLETED" || !daily.has(sale.businessDay) || !visibleIds.has(sale.sellingLocationId) || !saleMatchesScope(sale, input)) continue;
    const totals = daily.get(sale.businessDay)!;
    const outletTotals = byOutlet.get(sale.sellingLocationId)!;
    totals.salesMinor += sale.totalMinor;
    totals.completedTransactions++;
    outletTotals.salesMinor += sale.totalMinor;
    outletTotals.completedTransactions++;
    completedSaleIds.add(sale.id);
    saleLocationById.set(sale.id, sale.sellingLocationId);
    sourceWatermark = latestDate(sourceWatermark, sale.serverAcceptedAt);
  }

  for (const payment of memoryStore.payments.values()) {
    if (payment.organizationId !== input.scope.organizationId || !completedSaleIds.has(payment.saleId)) continue;
    const sale = memoryStore.sales.get(payment.saleId);
    if (!sale) continue;
    const dailyTotals = daily.get(sale.businessDay);
    const outletId = saleLocationById.get(sale.id);
    const outletTotals = outletId ? byOutlet.get(outletId) : undefined;
    if (!dailyTotals) continue;
    if (payment.status === "PAID" && payment.method === "CASH") {
      dailyTotals.cashPaidMinor += payment.amountMinor;
      if (outletTotals) outletTotals.cashPaidMinor += payment.amountMinor;
    } else if (payment.status === "PAID") {
      dailyTotals.digitalVerifiedMinor += payment.amountMinor;
      if (outletTotals) outletTotals.digitalVerifiedMinor += payment.amountMinor;
    } else if (payment.status === "PENDING_VERIFICATION" || payment.status === "PENDING" || payment.status === "AUTHORIZED") {
      dailyTotals.digitalUnverifiedMinor += payment.amountMinor;
      if (outletTotals) outletTotals.digitalUnverifiedMinor += payment.amountMinor;
    }
    sourceWatermark = latestDate(sourceWatermark, payment.updatedAt);
  }

  for (const expense of memoryStore.expenses.values()) {
    if (expense.organizationId !== input.scope.organizationId) continue;
    const shift = memoryStore.shifts.get(expense.shiftId);
    if (!shift || shift.organizationId !== input.scope.organizationId || !daily.has(shift.businessDay)) continue;
    if (input.scope.kind === "area" && memoryStore.stalls.get(shift.stallId)?.areaId !== input.scope.areaId) continue;
    if (input.scope.kind === "stall" && shift.stallId !== input.scope.stallId) continue;
    if (input.scope.kind === "self" && shift.operatorId !== input.scope.operatorId) continue;
    if (input.scope.kind === "region") continue;
    const outletId = expense.sellingLocationId ?? shift.startLocationId;
    if (!visibleIds.has(outletId)) continue;
    const dailyTotals = daily.get(shift.businessDay)!;
    const outletTotals = byOutlet.get(outletId)!;
    dailyTotals.reportedExpensesMinor += expense.amountMinor;
    outletTotals.reportedExpensesMinor += expense.amountMinor;
    sourceWatermark = latestDate(sourceWatermark, expense.createdAt);
  }

  const incidentByStatus: Record<string, number> = {};
  const incidentByCategory: Record<string, number> = {};
  let unattributedIncidentCount = 0;
  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== input.scope.organizationId) continue;
    const businessDay = toBusinessDay(incident.createdAt, DEFAULT_BUSINESS_DAY_CONFIG);
    const dailyTotals = daily.get(businessDay);
    if (!dailyTotals) continue;
    const association = applyScopeToIncident(incident, input, visibleIds);
    if (!association.include) continue;
    dailyTotals.incidentCount++;
    if (association.unattributed) unattributedIncidentCount++;
    else if (association.outletId) byOutlet.get(association.outletId)!.incidentCount++;
    incidentByStatus[incident.status] = (incidentByStatus[incident.status] ?? 0) + 1;
    incidentByCategory[incident.category] = (incidentByCategory[incident.category] ?? 0) + 1;
    sourceWatermark = latestDate(sourceWatermark, incident.updatedAt);
  }

  const series: ReportSeriesPoint[] = days.map((businessDay) => {
    const totals = daily.get(businessDay)!;
    return {
      businessDay,
      ...totals,
      salesAfterExpensesMinor: totals.salesMinor - totals.reportedExpensesMinor,
    };
  });
  const totals = series.reduce((acc, row) => {
    acc.salesMinor += row.salesMinor;
    acc.completedTransactions += row.completedTransactions;
    acc.cashPaidMinor += row.cashPaidMinor;
    acc.digitalVerifiedMinor += row.digitalVerifiedMinor;
    acc.digitalUnverifiedMinor += row.digitalUnverifiedMinor;
    acc.reportedExpensesMinor += row.reportedExpensesMinor;
    acc.incidentCount += row.incidentCount;
    return acc;
  }, emptyTotals());
  const allOutletRows: ReportOutletRow[] = visibleLocations.map((location) => {
    const row = byOutlet.get(location.id)!;
    return {
      id: location.id,
      name: location.name,
      areaId: location.areaId,
      ...row,
      averageTransactionMinor: row.completedTransactions ? Math.round(row.salesMinor / row.completedTransactions) : 0,
      salesAfterExpensesMinor: row.salesMinor - row.reportedExpensesMinor,
    };
  });
  const cursorIndex = input.cursor ? allOutletRows.findIndex((row) => row.id === input.cursor) : -1;
  if (input.cursor && cursorIndex < 0) throw new ReportQueryError("Report cursor is not valid for this scope and filter");
  const start = input.cursor ? cursorIndex + 1 : 0;
  const outletRows = allOutletRows.slice(start, start + limit);
  const nextCursor = start + limit < allOutletRows.length && outletRows.length ? outletRows[outletRows.length - 1]!.id : null;
  const totalOutlets = allOutletRows.length;
  const freshnessBand = sourceWatermark
    ? (now.getTime() - sourceWatermark.getTime() < 5 * 60_000 ? "current" : now.getTime() - sourceWatermark.getTime() < 60 * 60_000 ? "recent" : "stale")
    : "unknown";

  return {
    generatedAt: now.toISOString(),
    sourceWatermark: sourceWatermark?.toISOString() ?? null,
    freshnessBand,
    filters: { dateFrom, dateTo, areaId: input.areaId ?? null, outletId: input.outletId ?? null },
    summary: {
      salesMinor: totals.salesMinor,
      completedTransactions: totals.completedTransactions,
      averageTransactionMinor: totals.completedTransactions ? Math.round(totals.salesMinor / totals.completedTransactions) : 0,
      cashPaidMinor: totals.cashPaidMinor,
      digitalVerifiedMinor: totals.digitalVerifiedMinor,
      digitalUnverifiedMinor: totals.digitalUnverifiedMinor,
      reportedExpensesMinor: totals.reportedExpensesMinor,
      salesAfterExpensesMinor: totals.salesMinor - totals.reportedExpensesMinor,
      incidentCount: totals.incidentCount,
      unattributedIncidentCount,
      outletCount: totalOutlets,
    },
    incidents: {
      total: totals.incidentCount,
      unattributedCount: unattributedIncidentCount,
      byStatus: Object.fromEntries(Object.entries(incidentByStatus).sort(([a], [b]) => a.localeCompare(b))),
      byCategory: Object.fromEntries(Object.entries(incidentByCategory).sort(([a], [b]) => a.localeCompare(b))),
      locationBasis: "SHIFT_START_LOCATION",
    },
    series,
    outlets: outletRows,
    pagination: { limit, total: totalOutlets, nextCursor },
    options: {
      areas: Array.from(new Set(scopeAnchor.outletOptions.map((location) => location.areaId))).sort().map((id) => ({ id, label: id })),
      outlets: scopeAnchor.outletOptions.map(({ id, name, areaId }) => ({ id, name, areaId })).sort((a, b) => a.name.localeCompare(b.name, "id-ID") || a.id.localeCompare(b.id)),
    },
  };
}

export { HqDashboardNotFoundError };
