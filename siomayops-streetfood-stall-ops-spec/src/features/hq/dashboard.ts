import { authorize, type SessionContext } from "@/server/auth/port";
import { memoryStore, type StoredSale } from "@/server/db/memory-store";
import { openScopedReader } from "@/server/db/repository";
import { DEFAULT_BUSINESS_DAY_CONFIG, toBusinessDay, type BusinessDay } from "@/shared/time/business-day";
import type { Scope } from "@/shared/types/scope";

export class HqDashboardNotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor() {
    super("Outlet not found");
    this.name = "HqDashboardNotFoundError";
  }
}

export type OutletStatus = "OPERATING" | "ATTENTION" | "REVIEW" | "NOT_STARTED" | "CLOSED";
export type DashboardAlertKind = "SHIFT_LOCATION_MISSING" | "FLAGGED_EXPENSE" | "INCIDENT" | "RECORDED_ALERT";

export interface OutletSummary {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly operatorName: string | null;
  readonly operatorId: string | null;
  readonly activeShiftId: string | null;
  readonly startedAt: string | null;
  readonly salesMinor: number;
  readonly transactionCount: number;
  readonly expensesMinor: number;
  readonly status: OutletStatus;
  readonly statusReason: string | null;
}

export interface HqDashboardAlert {
  readonly id: string;
  readonly outletId: string | null;
  readonly outletName: string | null;
  readonly kind: DashboardAlertKind;
  readonly severity: "INFO" | "WARNING" | "CRITICAL";
  readonly title: string;
  readonly description: string;
  readonly createdAt: string;
  readonly href: string | null;
}

export interface HqDashboardActivity {
  readonly id: string;
  readonly occurredAt: string;
  readonly outletId: string | null;
  readonly outletName: string | null;
  readonly kind: "SALE" | "EXPENSE" | "SHIFT" | "PRODUCT" | "OTHER";
  readonly description: string;
  readonly amountMinor: number | null;
  readonly secondary: string | null;
}

export interface HqDashboardReadModel {
  readonly generatedAt: string;
  readonly sourceWatermark: string | null;
  readonly scope: { readonly businessDay: BusinessDay; readonly outletId: string | null };
  readonly kpis: {
    readonly salesMinor: number;
    readonly previousDaySalesMinor: number;
    readonly salesChangeBps: number | null;
    readonly transactionCount: number;
    readonly averageTransactionMinor: number;
    readonly cashSalesMinor: number;
    readonly digitalVerifiedMinor: number;
    readonly digitalUnverifiedMinor: number;
    readonly expensesMinor: number;
    readonly expenseRatioBps: number;
    readonly activeOutlets: number;
    readonly totalOutlets: number;
    readonly notStartedOutlets: number;
  };
  readonly salesTrend: readonly { readonly label: string; readonly cumulativeMinor: number }[];
  readonly alerts: readonly HqDashboardAlert[];
  readonly activity: readonly HqDashboardActivity[];
  readonly outletOptions: readonly { readonly id: string; readonly name: string; readonly areaId: string }[];
  readonly outlets: readonly OutletSummary[];
  readonly pagination: { readonly limit: number; readonly nextCursor: string | null; readonly total: number };
}

/**
 * Authorization scope for the dashboard, produced only by `authorizeHqScope()`.
 *
 * The session is the only source of scope: the read model cannot be called with a hand-written
 * scope object, and the brand cannot be forged at runtime (a missing or ambiguous scope is a DENY,
 * never a wider fallback — docs/security/PERMISSIONS.md §1).
 */
declare const AUTHORIZED_HQ_SCOPE: unique symbol;
export type AuthorizedHqScope = Scope & { readonly [AUTHORIZED_HQ_SCOPE]: "hq:dashboard" };

/**
 * Resolve a session into a dashboard-safe scope, fail closed.
 *
 *  1. the session scope must belong to the session organization;
 *  2. the role must hold `hq:view` for that scope (existing `authorize()` port);
 *  3. the scope must be resolvable by the scoped reader, so `region` and incomplete
 *     `area`/`stall`/`self` scopes are denied instead of silently returning an empty page.
 */
export function authorizeHqScope(session: SessionContext): AuthorizedHqScope {
  if (session.scope.organizationId !== session.organizationId) {
    throw Object.assign(new Error("Session scope does not belong to the session organization"), { code: "FORBIDDEN" });
  }
  authorize(session, "hq:view", session.scope);
  openScopedReader(session.scope);
  return session.scope as AuthorizedHqScope;
}

export interface DashboardQuery {
  readonly scope: AuthorizedHqScope;
  readonly businessDay: BusinessDay;
  readonly outletId?: string;
  readonly areaId?: string;
  readonly search?: string;
  readonly status?: "ALL" | OutletStatus;
  readonly cursor?: string;
  readonly limit?: number;
}

const ACTIVE_SHIFT_STATUSES = new Set(["OPEN", "PENDING_SYNC"]);
const CLOSED_LOCATION_STATUSES = new Set(["INACTIVE", "RESTRICTED", "TEMPORARILY_UNAVAILABLE"]);
const HOURS = [6, 8, 10, 12, 14, 16, 18] as const;
const jakartaDay = (date: Date) => toBusinessDay(date, DEFAULT_BUSINESS_DAY_CONFIG);
const atIso = (date: Date | undefined) => date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;

function outletLocationForShift(shiftId: string): string | null {
  const reports = Array.from(memoryStore.locationReports.values())
    .filter((report) => report.shiftId === shiftId && !report.departedAt)
    .sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime());
  if (reports[0]) return reports[0].sellingLocationId;
  return memoryStore.shifts.get(shiftId)?.startLocationId ?? null;
}

function locationHasShiftOrOperator(locationId: string, scope: Scope): boolean {
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== scope.organizationId) continue;
    if (scope.kind === "stall" && shift.stallId !== scope.stallId) continue;
    if (scope.kind === "self" && shift.operatorId !== scope.operatorId) continue;
    if (shift.startLocationId === locationId || outletLocationForShift(shift.id) === locationId) return true;
    for (const report of memoryStore.locationReports.values()) {
      if (report.organizationId === scope.organizationId && report.shiftId === shift.id && report.sellingLocationId === locationId) return true;
    }
  }
  return false;
}

function canSeeLocation(location: { organizationId: string; areaId: string; id: string }, scope: Scope): boolean {
  if (location.organizationId !== scope.organizationId) return false;
  switch (scope.kind) {
    case "org": return true;
    case "area": return Boolean(scope.areaId) && location.areaId === scope.areaId;
    // The pilot runtime has no Region entity/map to prove membership. Fail closed rather than broaden.
    case "region": return false;
    case "stall": return Boolean(scope.stallId) && locationHasShiftOrOperator(location.id, scope);
    case "self": return Boolean(scope.operatorId) && locationHasShiftOrOperator(location.id, scope);
  }
}

function previousBusinessDay(day: BusinessDay): BusinessDay {
  const parts = day.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const date = parts[2] ?? 1;
  const previous = new Date(Date.UTC(year, month - 1, date - 1, 12));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}-${String(previous.getUTCDate()).padStart(2, "0")}`;
}

function rangeContains(day: BusinessDay, date: Date): boolean {
  return jakartaDay(date) === day;
}

function scopedLocations(scope: Scope, outletId?: string, areaId?: string) {
  if (scope.kind === "area" && areaId && areaId !== scope.areaId) throw new HqDashboardNotFoundError();
  const visible = Array.from(memoryStore.sellingLocations.values())
    .filter((location) => canSeeLocation(location, scope))
    .filter((location) => !areaId || location.areaId === areaId);
  if (!outletId) return visible;
  const selected = visible.find((location) => location.id === outletId);
  if (!selected) throw new HqDashboardNotFoundError();
  return [selected];
}

function shiftsForDay(scope: Scope, day: BusinessDay, locationIds: Set<string>) {
  return Array.from(memoryStore.shifts.values()).filter((shift) => {
    if (shift.organizationId !== scope.organizationId || shift.businessDay !== day) return false;
    if (scope.kind === "area") {
      const stall = memoryStore.stalls.get(shift.stallId);
      if (!scope.areaId || stall?.areaId !== scope.areaId) return false;
    } else if (scope.kind === "stall" && shift.stallId !== scope.stallId) return false;
    else if (scope.kind === "self" && shift.operatorId !== scope.operatorId) return false;
    else if (scope.kind === "region") return false;
    return locationIds.has(outletLocationForShift(shift.id) ?? "");
  });
}

function locationIdForExpense(expense: { sellingLocationId?: string; shiftId: string }): string | null {
  if (expense.sellingLocationId) return expense.sellingLocationId;
  const shift = memoryStore.shifts.get(expense.shiftId);
  return shift?.startLocationId ?? null;
}

function latestWatermark(dates: (Date | undefined)[]): string | null {
  const valid = dates.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  if (!valid.length) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime()))).toISOString();
}

function formatOutletActivity(id: string | undefined, visible: Map<string, { id: string; name: string }>) {
  if (!id) return { id: null, name: null };
  const outlet = visible.get(id);
  return outlet ? { id: outlet.id, name: outlet.name } : { id: null, name: null };
}

function getActivity(scope: Scope, day: BusinessDay, visibleLocations: Map<string, { id: string; name: string }>, selectedOutletId?: string): HqDashboardActivity[] {
  const events = memoryStore.auditEvents
    .filter((event) => event.organizationId === scope.organizationId && rangeContains(day, event.occurredAt))
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const result: HqDashboardActivity[] = [];
  for (const event of events) {
    let outletId: string | undefined;
    let kind: HqDashboardActivity["kind"] = "OTHER";
    let description = event.action.replaceAll(".", " ");
    let amountMinor: number | null = null;
    let secondary: string | null = null;
    const payload = event.newValueJson ? safeJson(event.newValueJson) : {};
    if (event.entityType === "sale") {
      const sale = memoryStore.sales.get(event.entityId);
      outletId = sale?.sellingLocationId;
      kind = "SALE";
      description = event.action === "sale.created" ? "Transaksi dibuat" : "Transaksi diperbarui";
      amountMinor = sale?.totalMinor ?? null;
    } else if (event.entityType === "payment") {
      const payment = memoryStore.payments.get(event.entityId);
      const sale = payment ? memoryStore.sales.get(payment.saleId) : undefined;
      outletId = sale?.sellingLocationId;
      kind = "SALE";
      description = event.action === "payment.recorded" ? "Mencatat transaksi" : "Pembaruan pembayaran";
      amountMinor = payment?.amountMinor ?? null;
    } else if (event.entityType === "expense") {
      const expense = memoryStore.expenses.get(event.entityId);
      outletId = expense ? locationIdForExpense(expense) ?? undefined : undefined;
      kind = "EXPENSE";
      description = event.action === "expense.submitted" ? "Mencatat pengeluaran" : "Pembaruan pengeluaran";
      amountMinor = expense?.amountMinor ?? null;
      secondary = expense?.category ?? null;
    } else if (event.entityType === "shift") {
      const shift = memoryStore.shifts.get(event.entityId);
      outletId = shift ? outletLocationForShift(shift.id) ?? undefined : undefined;
      kind = event.action === "shift.started" ? "SHIFT" : "OTHER";
      const operator = shift ? memoryStore.operators.get(shift.operatorId) : undefined;
      description = event.action === "shift.started" ? `Operator ${operator?.name ?? ""} memulai operasional`.trim() : "Pembaruan operasional";
    } else if (event.entityType === "price_policy") {
      const policy = Array.from(memoryStore.pricePolicies.values()).find((item) => item.id === event.entityId);
      const item = policy ? memoryStore.menuItems.get(policy.menuItemId) : undefined;
      outletId = policy?.scope === "LOCATION" ? policy.scopeId : undefined;
      kind = "PRODUCT";
      description = item ? `Harga ${item.name} diperbarui` : "Kebijakan harga diperbarui";
    } else if (event.entityType === "stock_movement") {
      const movement = memoryStore.stockMovements.get(event.entityId);
      const item = movement ? memoryStore.stockItems.get(movement.stockItemId) : undefined;
      outletId = movement?.stallId ? outletLocationForStall(movement.stallId, day) ?? undefined : undefined;
      kind = "OTHER";
      description = item ? `Pergerakan stok ${item.name}` : "Pergerakan stok dicatat";
    } else {
      // Include known location records only when they can be resolved to a scoped outlet.
      outletId = typeof payload.sellingLocationId === "string" ? payload.sellingLocationId : undefined;
    }
    if (!outletId && (selectedOutletId || scope.kind !== "org")) continue;
    if (outletId && !visibleLocations.has(outletId)) continue;
    if (selectedOutletId && outletId !== selectedOutletId) continue;
    const outlet = formatOutletActivity(outletId, visibleLocations);
    result.push({ id: event.id, occurredAt: event.occurredAt.toISOString(), outletId: outlet.id, outletName: outlet.name, kind, description, amountMinor, secondary });
    if (result.length === 8) break;
  }
  return result;
}

function outletLocationForStall(stallId: string, day: BusinessDay): string | null {
  const shift = Array.from(memoryStore.shifts.values()).find((item) => item.stallId === stallId && item.businessDay === day);
  return shift ? outletLocationForShift(shift.id) : null;
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function getAlerts(scope: Scope, day: BusinessDay, visibleLocations: Map<string, { id: string; name: string }>, selectedOutletId?: string): HqDashboardAlert[] {
  const result: HqDashboardAlert[] = [];
  const seen = new Set<string>();
  const add = (alert: HqDashboardAlert) => {
    const key = `${alert.kind}:${alert.id}`;
    if (seen.has(key)) return;
    if (selectedOutletId && alert.outletId !== selectedOutletId) return;
    if (scope.kind !== "org" && !alert.outletId) return;
    if (alert.outletId && !visibleLocations.has(alert.outletId)) return;
    seen.add(key);
    result.push(alert);
  };
  const byShift = new Map(Array.from(memoryStore.shifts.values()).map((shift) => [shift.id, shift]));

  for (const stored of memoryStore.alerts.values()) {
    if (stored.organizationId !== scope.organizationId || stored.acknowledged || !rangeContains(day, stored.createdAt)) continue;
    const relatedId = stored.relatedEntityId;
    let outletId: string | null = null;
    if (relatedId) {
      if (memoryStore.sellingLocations.has(relatedId)) outletId = relatedId;
      else if (memoryStore.shifts.has(relatedId)) outletId = outletLocationForShift(relatedId);
      else if (memoryStore.incidents.has(relatedId)) {
        const incident = memoryStore.incidents.get(relatedId);
        const shift = incident?.shiftId ? byShift.get(incident.shiftId) : undefined;
        outletId = shift ? outletLocationForShift(shift.id) : null;
      }
    }
    const outlet = outletId ? visibleLocations.get(outletId) : undefined;
    add({ id: stored.id, outletId: outlet?.id ?? null, outletName: outlet?.name ?? null, kind: "RECORDED_ALERT", severity: stored.severity, title: stored.type, description: stored.message, createdAt: stored.createdAt.toISOString(), href: stored.relatedEntityType && stored.relatedEntityId ? `/hq/records/${encodeURIComponent(stored.relatedEntityType)}/${encodeURIComponent(stored.relatedEntityId)}` : null });
  }

  for (const shift of shiftsForDay(scope, day, new Set(visibleLocations.keys()))) {
    if (!ACTIVE_SHIFT_STATUSES.has(shift.status)) continue;
    const hasOpenReport = Array.from(memoryStore.locationReports.values()).some((report) => report.shiftId === shift.id && !report.departedAt);
    const age = Date.now() - shift.startedAt.getTime();
    if (!hasOpenReport && age >= 30 * 60 * 1000) {
      const locationId = outletLocationForShift(shift.id);
      const outlet = locationId ? visibleLocations.get(locationId) : undefined;
      add({ id: shift.id, outletId: outlet?.id ?? null, outletName: outlet?.name ?? null, kind: "SHIFT_LOCATION_MISSING", severity: "WARNING", title: outlet?.name ?? "Outlet", description: "Shift aktif belum memiliki laporan lokasi setelah 30 menit", createdAt: shift.startedAt.toISOString(), href: `/hq/outlets/${encodeURIComponent(locationId ?? "")}?date=${day}` });
    }
  }
  for (const expense of memoryStore.expenses.values()) {
    if (expense.organizationId !== scope.organizationId || !expense.flaggedReason) continue;
    const shift = memoryStore.shifts.get(expense.shiftId);
    if (!shift || shift.businessDay !== day) continue;
    const locationId = locationIdForExpense(expense);
    const outlet = locationId ? visibleLocations.get(locationId) : undefined;
    add({ id: expense.id, outletId: outlet?.id ?? null, outletName: outlet?.name ?? null, kind: "FLAGGED_EXPENSE", severity: "WARNING", title: outlet?.name ?? "Pengeluaran", description: `Pengeluaran perlu ditinjau (${expense.flaggedReason})`, createdAt: expense.createdAt.toISOString(), href: `/hq/records/expense/${encodeURIComponent(expense.id)}` });
  }
  for (const incident of memoryStore.incidents.values()) {
    if (incident.organizationId !== scope.organizationId || incident.status === "CLOSED" || incident.status === "RESOLVED") continue;
    const shift = incident.shiftId ? byShift.get(incident.shiftId) : undefined;
    if (shift && shift.businessDay !== day) continue;
    const outletId = shift ? outletLocationForShift(shift.id) : null;
    const outlet = outletId ? visibleLocations.get(outletId) : undefined;
    add({ id: incident.id, outletId: outlet?.id ?? null, outletName: outlet?.name ?? null, kind: "INCIDENT", severity: "WARNING", title: outlet?.name ?? "Insiden", description: incident.description, createdAt: incident.createdAt.toISOString(), href: `/hq/incidents?incidentId=${encodeURIComponent(incident.id)}` });
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
}

function getOutletSummaries(scope: Scope, day: BusinessDay, locations: ReturnType<typeof scopedLocations>, search: string, status: DashboardQuery["status"], cursor: string | undefined, limit: number, attentionIds: Set<string>) {
  const shifts = shiftsForDay(scope, day, new Set(locations.map((location) => location.id)));
  const todayShiftByOutlet = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const locationId = outletLocationForShift(shift.id);
    if (!locationId) continue;
    const rows = todayShiftByOutlet.get(locationId) ?? [];
    rows.push(shift);
    todayShiftByOutlet.set(locationId, rows);
  }
  const completedSales = Array.from(memoryStore.sales.values()).filter((sale) => sale.organizationId === scope.organizationId && sale.businessDay === day && sale.status === "COMPLETED");
  const salesByOutlet = new Map<string, { total: number; count: number }>();
  for (const sale of completedSales) {
    const total = salesByOutlet.get(sale.sellingLocationId) ?? { total: 0, count: 0 };
    total.total += sale.totalMinor;
    total.count++;
    salesByOutlet.set(sale.sellingLocationId, total);
  }
  const expensesByOutlet = new Map<string, number>();
  for (const expense of memoryStore.expenses.values()) {
    if (expense.organizationId !== scope.organizationId) continue;
    if (expense.reviewStatus === "REJECTED") continue; // data-map §3.4
    const shift = memoryStore.shifts.get(expense.shiftId);
    if (!shift || shift.businessDay !== day) continue;
    const locationId = locationIdForExpense(expense);
    if (locationId) expensesByOutlet.set(locationId, (expensesByOutlet.get(locationId) ?? 0) + expense.amountMinor);
  }

  let rows: OutletSummary[] = locations.map((location) => {
    const locationShifts = todayShiftByOutlet.get(location.id) ?? [];
    const active = locationShifts.filter((shift) => ACTIVE_SHIFT_STATUSES.has(shift.status)).sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    const shift = active[0];
    const operator = shift ? memoryStore.operators.get(shift.operatorId) : undefined;
    const saleTotal = salesByOutlet.get(location.id) ?? { total: 0, count: 0 };
    let rowStatus: OutletStatus;
    let statusReason: string | null = null;
    if (shift && attentionIds.has(location.id)) {
      rowStatus = "ATTENTION";
      statusReason = "Ada hal yang memerlukan tindak lanjut";
    } else if (shift && Array.from(memoryStore.expenses.values()).some((expense) => expense.organizationId === scope.organizationId && expense.flaggedReason && expense.shiftId === shift.id)) {
      rowStatus = "REVIEW";
      statusReason = "Pengeluaran perlu ditinjau";
    } else if (shift) {
      rowStatus = "OPERATING";
    } else if (CLOSED_LOCATION_STATUSES.has(location.status)) {
      rowStatus = "CLOSED";
      statusReason = location.status;
    } else if (day >= jakartaDay(new Date())) {
      rowStatus = "NOT_STARTED";
    } else {
      rowStatus = "CLOSED";
    }
    return { id: location.id, name: location.name, areaId: location.areaId, operatorName: operator?.name ?? null, operatorId: operator?.id ?? null, activeShiftId: shift?.id ?? null, startedAt: atIso(shift?.startedAt), salesMinor: saleTotal.total, transactionCount: saleTotal.count, expensesMinor: expensesByOutlet.get(location.id) ?? 0, status: rowStatus, statusReason };
  });
  if (search) {
    const term = search.trim().toLocaleLowerCase("id-ID");
    rows = rows.filter((row) => `${row.name} ${row.operatorName ?? ""} ${row.status}`.toLocaleLowerCase("id-ID").includes(term));
  }
  if (status && status !== "ALL") rows = rows.filter((row) => row.status === status);
  rows.sort((a, b) => a.name.localeCompare(b.name, "id-ID") || a.id.localeCompare(b.id));
  const startIndex = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
  const safeStart = Math.max(0, startIndex);
  const page = rows.slice(safeStart, safeStart + limit);
  const nextCursor = safeStart + limit < rows.length && page.length ? page[page.length - 1]!.id : null;
  return { rows: page, nextCursor, total: rows.length, shifts };
}

function salesForScopeDay(scope: Scope, day: BusinessDay, selectedOutletId?: string, areaId?: string) {
  const visibleOutletIds = new Set(scopedLocations(scope, undefined, areaId).map((location) => location.id));
  const sales = Array.from(memoryStore.sales.values()).filter((sale) => {
    if (sale.organizationId !== scope.organizationId || sale.businessDay !== day) return false;
    if (sale.status !== "COMPLETED" && sale.status !== "DRAFT") return false;
    if (!visibleOutletIds.has(sale.sellingLocationId)) return false;
    return !selectedOutletId || sale.sellingLocationId === selectedOutletId;
  });
  const completed = sales.filter((sale) => sale.status === "COMPLETED");
  return { sales, completed, visibleOutletIds };
}

function paymentTotals(saleIds: Set<string>) {
  let cash = 0;
  let verifiedDigital = 0;
  let unverifiedDigital = 0;
  for (const payment of memoryStore.payments.values()) {
    if (!saleIds.has(payment.saleId)) continue;
    if (payment.status === "PAID" && payment.method === "CASH") cash += payment.amountMinor;
    else if (payment.status === "PAID") verifiedDigital += payment.amountMinor;
    else if (payment.status === "PENDING_VERIFICATION" || payment.status === "PENDING" || payment.status === "AUTHORIZED") unverifiedDigital += payment.amountMinor;
  }
  return { cash, verifiedDigital, unverifiedDigital };
}

function getSalesTrend(completedSales: StoredSale[], _day: BusinessDay): { label: string; cumulativeMinor: number }[] {
  const hourly = new Map<number, number>();
  for (const sale of completedSales) {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(sale.occurredAt));
    hourly.set(hour, (hourly.get(hour) ?? 0) + sale.totalMinor);
  }
  let cumulative = 0;
  for (let hour = 0; hour < 6; hour++) cumulative += hourly.get(hour) ?? 0;
  return HOURS.map((hour) => {
    for (let next = hour === 6 ? 6 : (hour === 8 ? 7 : hour - 1); next <= hour; next++) cumulative += hourly.get(next) ?? 0;
    // Include late transactions in the final day total rather than implying they disappeared.
    if (hour === 18) for (let late = 19; late < 24; late++) cumulative += hourly.get(late) ?? 0;
    return { label: `${String(hour).padStart(2, "0")}:00`, cumulativeMinor: cumulative };
  });
}

export function getHqDashboard(input: DashboardQuery): HqDashboardReadModel {
  const now = new Date();
  const locations = scopedLocations(input.scope, input.outletId, input.areaId);
  const allVisibleLocations = scopedLocations(input.scope, undefined, input.areaId);
  const allVisible = new Map(allVisibleLocations.map((location) => [location.id, { id: location.id, name: location.name }]));
  const { sales, completed } = salesForScopeDay(input.scope, input.businessDay, input.outletId, input.areaId);
  const salesMinor = completed.reduce((sum, sale) => sum + sale.totalMinor, 0);
  const saleIds = new Set(sales.map((sale) => sale.id));
  const payments = paymentTotals(saleIds);
  const previousDay = previousBusinessDay(input.businessDay);
  const previousSales = Array.from(memoryStore.sales.values()).filter((sale) => sale.organizationId === input.scope.organizationId && sale.businessDay === previousDay && sale.status === "COMPLETED" && allVisible.has(sale.sellingLocationId) && (!input.outletId || sale.sellingLocationId === input.outletId)).reduce((sum, sale) => sum + sale.totalMinor, 0);
  const transactionCount = completed.length;
  const expenseRows = Array.from(memoryStore.expenses.values()).filter((expense) => {
    if (expense.organizationId !== input.scope.organizationId) return false;
    // Data-map rule (§3.4): a rejected expense is not a cost of the day. The record itself stays
    // visible (it is never deleted); only the aggregate excludes it.
    if (expense.reviewStatus === "REJECTED") return false;
    const shift = memoryStore.shifts.get(expense.shiftId);
    if (!shift || shift.businessDay !== input.businessDay) return false;
    const locationId = locationIdForExpense(expense);
    return Boolean(locationId && allVisible.has(locationId) && (!input.outletId || locationId === input.outletId));
  });
  const expensesMinor = expenseRows.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const dayShifts = shiftsForDay(input.scope, input.businessDay, new Set(locations.map((location) => location.id)));
  const activeOutletIds = new Set(dayShifts.filter((shift) => ACTIVE_SHIFT_STATUSES.has(shift.status)).map((shift) => outletLocationForShift(shift.id)).filter((id): id is string => Boolean(id)));
  const activeOutlets = activeOutletIds.size;
  const notStartedOutlets = Math.max(0, locations.filter((location) => !CLOSED_LOCATION_STATUSES.has(location.status)).length - activeOutlets);
  const alerts = getAlerts(input.scope, input.businessDay, allVisible, input.outletId);
  const attentionIds = new Set(alerts.map((alert) => alert.outletId).filter((id): id is string => Boolean(id)));
  const outletPage = getOutletSummaries(input.scope, input.businessDay, locations, input.search ?? "", input.status ?? "ALL", input.cursor, input.limit ?? 6, attentionIds);
  const trend = getSalesTrend(completed.filter((sale) => !input.outletId || sale.sellingLocationId === input.outletId), input.businessDay);
  const relevantDates: (Date | undefined)[] = [
    ...sales.map((sale) => sale.serverAcceptedAt),
    ...expenseRows.map((expense) => expense.createdAt),
    ...dayShifts.map((shift) => shift.updatedAt),
    ...alerts.map((alert) => new Date(alert.createdAt)),
  ];
  const sourceWatermark = latestWatermark(relevantDates);
  return {
    generatedAt: now.toISOString(),
    sourceWatermark,
    scope: { businessDay: input.businessDay, outletId: input.outletId ?? null },
    kpis: {
      salesMinor,
      previousDaySalesMinor: previousSales,
      salesChangeBps: previousSales > 0 ? Math.round(((salesMinor - previousSales) / previousSales) * 10000) : null,
      transactionCount,
      averageTransactionMinor: transactionCount ? Math.round(salesMinor / transactionCount) : 0,
      cashSalesMinor: payments.cash,
      digitalVerifiedMinor: payments.verifiedDigital,
      digitalUnverifiedMinor: payments.unverifiedDigital,
      expensesMinor,
      expenseRatioBps: salesMinor ? Math.round((expensesMinor / salesMinor) * 10000) : 0,
      activeOutlets,
      totalOutlets: locations.length,
      notStartedOutlets,
    },
    salesTrend: trend,
    alerts,
    activity: getActivity(input.scope, input.businessDay, allVisible, input.outletId),
    outletOptions: allVisibleLocations.map(({ id, name, areaId }) => ({ id, name, areaId })).sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
    outlets: outletPage.rows,
    pagination: { limit: input.limit ?? 6, nextCursor: outletPage.nextCursor, total: outletPage.total },
  };
}

export interface HqOutletDetail {
  readonly generatedAt: string;
  readonly sourceWatermark: string | null;
  readonly businessDay: BusinessDay;
  readonly outlet: OutletSummary;
  readonly transactions: readonly { id: string; occurredAt: string; totalMinor: number; status: string; paymentStatus: string | null }[];
  readonly expenses: readonly { id: string; occurredAt: string; amountMinor: number; category: string; description: string; reviewStatus: string }[];
  readonly nextCursor: string | null;
}

export function getHqOutletDetail(input: { scope: AuthorizedHqScope; businessDay: BusinessDay; outletId: string; cursor?: string; limit?: number }): HqOutletDetail {
  const dashboard = getHqDashboard({ scope: input.scope, businessDay: input.businessDay, outletId: input.outletId, limit: 200 });
  const outlet = dashboard.outlets.find((row) => row.id === input.outletId);
  if (!outlet) throw new HqDashboardNotFoundError();
  const location = memoryStore.sellingLocations.get(input.outletId);
  if (!location || !canSeeLocation(location, input.scope)) throw new HqDashboardNotFoundError();
  const visibleShifts = shiftsForDay(input.scope, input.businessDay, new Set([input.outletId]));
  const shiftIds = new Set(visibleShifts.filter((shift) => outletLocationForShift(shift.id) === input.outletId).map((shift) => shift.id));
  const transactionRows = Array.from(memoryStore.sales.values()).filter((sale) => sale.organizationId === input.scope.organizationId && sale.businessDay === input.businessDay && sale.sellingLocationId === input.outletId && sale.status === "COMPLETED").map((sale) => {
    const payment = Array.from(memoryStore.payments.values()).find((candidate) => candidate.saleId === sale.id);
    return { id: sale.id, occurredAt: sale.occurredAt.toISOString(), totalMinor: sale.totalMinor, status: sale.status, paymentStatus: payment?.status ?? null };
  });
  const expenseRows = Array.from(memoryStore.expenses.values()).filter((expense) => expense.organizationId === input.scope.organizationId && shiftIds.has(expense.shiftId) && locationIdForExpense(expense) === input.outletId).map((expense) => ({ id: expense.id, occurredAt: expense.incurredAt.toISOString(), amountMinor: expense.amountMinor, category: expense.category, description: expense.description, reviewStatus: expense.reviewStatus }));
  const combined = [
    ...transactionRows.map((row) => ({ id: row.id, date: row.occurredAt })),
    ...expenseRows.map((row) => ({ id: row.id, date: row.occurredAt })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const cursorIndex = input.cursor ? combined.findIndex((row) => row.id === input.cursor) + 1 : 0;
  const start = Math.max(0, cursorIndex);
  const limit = input.limit ?? 20;
  const slice = combined.slice(start, start + limit);
  const ids = new Set(slice.map((row) => row.id));
  const nextCursor = start + limit < combined.length && slice.length ? slice[slice.length - 1]!.id : null;
  const transactions = transactionRows.filter((row) => ids.has(row.id));
  const expenses = expenseRows.filter((row) => ids.has(row.id));
  return { generatedAt: dashboard.generatedAt, sourceWatermark: dashboard.sourceWatermark, businessDay: input.businessDay, outlet, transactions, expenses, nextCursor };
}

export function getDefaultDashboardDay(now = new Date()): BusinessDay {
  return toBusinessDay(now, DEFAULT_BUSINESS_DAY_CONFIG);
}
