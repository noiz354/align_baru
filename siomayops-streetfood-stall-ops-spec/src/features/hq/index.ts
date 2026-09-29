import { memoryStore, syncFromDiskIfNeeded, toJakartanBusinessDay } from "../../server/db/memory-store";
import { repositories } from "../../server/db/repository";
import { authorize, type SessionContext } from "../../server/auth/port";
import { getAuthorizedOutlets, type AuthorizedOutletInfo } from "../sales";
import type { BusinessDay } from "../../shared/time";
import { money, type Money } from "../../shared/money/money";

export interface ReadModelEnvelope<T> {
  readonly computedAt: Date;
  readonly sourceWatermark?: string;
  readonly freshnessBand: "current" | "recent" | "stale";
  readonly value: T;
}

export interface CoverageCardValue {
  readonly shiftsActive: number;
  readonly shiftsWithoutLocationReport: number;
  readonly stallsIdle: number;
}

function freshnessBand(computedAt: Date): "current" | "recent" | "stale" {
  const ageMs = Date.now() - computedAt.getTime();
  const ageMin = ageMs / 60000;
  if (ageMin < 5) return "current";
  if (ageMin < 60) return "recent";
  return "stale";
}

export async function getCoverageCard(input: {
  organizationId: string; businessDay: BusinessDay;
}): Promise<ReadModelEnvelope<CoverageCardValue>> {
  const now = new Date();
  let shiftsActive = 0;
  let shiftsWithoutLocation = 0;
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== input.organizationId) continue;
    if (shift.businessDay !== input.businessDay) continue;
    if (shift.status === "OPEN" || shift.status === "PENDING_SYNC") {
      shiftsActive++;
      let hasLocation = false;
      for (const lr of memoryStore.locationReports.values()) {
        if (lr.shiftId === shift.id && !lr.departedAt) { hasLocation = true; break; }
      }
      if (!hasLocation) shiftsWithoutLocation++;
    }
  }
  let stallsIdle = 0;
  for (const stall of memoryStore.stalls.values()) {
    if (stall.organizationId !== input.organizationId) continue;
    let active = false;
    for (const shift of memoryStore.shifts.values()) {
      if (shift.stallId === stall.id && (shift.status === "OPEN" || shift.status === "PENDING_SYNC")) { active = true; break; }
    }
    if (!active) stallsIdle++;
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { shiftsActive, shiftsWithoutLocationReport: shiftsWithoutLocation, stallsIdle },
  };
}

export interface VerificationBacklogValue {
  readonly pendingCount: number;
  readonly pendingAmountUnverified: Money;
  readonly oldestAgeHours: number;
}

export async function getVerificationBacklogCard(input: {
  organizationId: string;
}): Promise<ReadModelEnvelope<VerificationBacklogValue>> {
  const now = new Date();
  let pendingCount = 0;
  let pendingAmount = 0;
  let oldest: Date | null = null;
  for (const pay of memoryStore.payments.values()) {
    if (pay.organizationId !== input.organizationId) continue;
    if (pay.status === "PENDING_VERIFICATION" || pay.status === "PENDING") {
      pendingCount++;
      pendingAmount += pay.amountMinor;
      if (!oldest || pay.createdAt < oldest) oldest = pay.createdAt;
    }
  }
  const oldestAgeHours = oldest ? (now.getTime() - oldest.getTime()) / 3600000 : 0;
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: {
      pendingCount,
      pendingAmountUnverified: money(pendingAmount, "IDR"),
      oldestAgeHours,
    }
  };
}

export interface CashPositionCardValue {
  readonly expectedCash: Money;
  readonly countedCash: Money;
  readonly varianceAmount: Money;
  readonly unresolvedVerificationsCount: number;
}

export async function getCashPositionCard(input: {
  organizationId: string; businessDay: BusinessDay;
}): Promise<ReadModelEnvelope<CashPositionCardValue>> {
  const now = new Date();
  let expected = 0;
  let counted = 0;
  let unresolved = 0;
  for (const closing of memoryStore.closings.values()) {
    if (closing.organizationId !== input.organizationId) continue;
    const shift = memoryStore.shifts.get(closing.shiftId);
    if (!shift) continue;
    if (shift.businessDay !== input.businessDay) continue;
    expected += closing.expectedCashMinor;
    counted += closing.countedCashMinor;
  }
  for (const pay of memoryStore.payments.values()) {
    if (pay.organizationId !== input.organizationId) continue;
    if (pay.status === "PENDING_VERIFICATION") unresolved++;
  }
  const variance = counted - expected;
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: {
      expectedCash: money(expected, "IDR"),
      countedCash: money(counted, "IDR"),
      varianceAmount: money(variance, "IDR"),
      unresolvedVerificationsCount: unresolved,
    }
  };
}

export async function drillDown(input: {
  organizationId: string; card: string; key: string; cursor?: string;
}): Promise<{ readonly rows: readonly unknown[]; readonly nextCursor?: string }> {
  switch (input.card) {
    case "coverage": {
      const shifts = Array.from(memoryStore.shifts.values()).filter(s => s.organizationId === input.organizationId && (s.status === "OPEN"));
      return { rows: shifts.slice(0, 50) };
    }
    case "verification": {
      const pays = Array.from(memoryStore.payments.values()).filter(p => p.organizationId === input.organizationId && p.status === "PENDING_VERIFICATION");
      return { rows: pays.slice(0, 50) };
    }
    case "cash": {
      const closings = Array.from(memoryStore.closings.values()).filter(c => c.organizationId === input.organizationId);
      return { rows: closings.slice(0, 50) };
    }
    case "expenses": {
      const expenses = Array.from(memoryStore.expenses.values()).filter(e => e.organizationId === input.organizationId);
      return { rows: expenses.slice(0, 50) };
    }
    case "stock": {
      const movements = Array.from(memoryStore.stockMovements.values()).filter(m => m.organizationId === input.organizationId);
      return { rows: movements.slice(0, 50) };
    }
    default:
      return { rows: [] };
  }
}

// Additional cards for HQ dashboard v2
export async function getSalesCard(input: { organizationId: string; businessDay: BusinessDay }): Promise<ReadModelEnvelope<{ totalSales: Money; count: number }>> {
  const now = new Date();
  let total = 0;
  let count = 0;
  for (const sale of memoryStore.sales.values()) {
    if (sale.organizationId !== input.organizationId) continue;
    if (sale.businessDay !== input.businessDay) continue;
    if (sale.status === "COMPLETED") {
      total += sale.totalMinor;
      count++;
    }
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { totalSales: money(total, "IDR"), count },
  };
}

export async function getExpenseReviewQueueCard(input: { organizationId: string }): Promise<ReadModelEnvelope<{ pending: number; flagged: number }>> {
  const now = new Date();
  let pending = 0;
  let flagged = 0;
  for (const exp of memoryStore.expenses.values()) {
    if (exp.organizationId !== input.organizationId) continue;
    if (exp.reviewStatus === "SUBMITTED" || exp.reviewStatus === "REVIEW_REQUIRED") pending++;
    if ((exp as any).flaggedReason) flagged++;
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { pending, flagged },
  };
}

export async function getIncidentBoardCard(input: { organizationId: string }): Promise<ReadModelEnvelope<{ open: number; critical: number }>> {
  const now = new Date();
  let open = 0;
  let critical = 0;
  for (const inc of memoryStore.incidents.values()) {
    if (inc.organizationId !== input.organizationId) continue;
    if (inc.status !== "CLOSED" && inc.status !== "RESOLVED") open++;
    if ((inc as any).severity === "CRITICAL") critical++;
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { open, critical },
  };
}

export async function getStockPositionCard(input: { organizationId: string }): Promise<ReadModelEnvelope<{ lowStock: number; outOfStock: number }>> {
  const now = new Date();
  // Simplified
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { lowStock: 0, outOfStock: 0 },
  };
}

export async function getClosingCompletenessCard(input: { organizationId: string; businessDay: BusinessDay }): Promise<ReadModelEnvelope<{ submitted: number; missing: number }>> {
  const now = new Date();
  let submitted = 0;
  let totalActive = 0;
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== input.organizationId) continue;
    if (shift.businessDay !== input.businessDay) continue;
    totalActive++;
    if (shift.status === "CLOSING_SUBMITTED" || shift.status === "CLOSED_ACCEPTED") submitted++;
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { submitted, missing: Math.max(0, totalActive - submitted) },
  };
}

export async function getLocationUsageCard(input: { organizationId: string }): Promise<ReadModelEnvelope<{ activeLocations: number; crowded: number }>> {
  const now = new Date();
  let active = 0;
  let crowded = 0;
  for (const loc of memoryStore.sellingLocations.values()) {
    if (loc.organizationId !== input.organizationId) continue;
    if (loc.status === "ACTIVE") active++;
    if (loc.status === "CROWDED") crowded++;
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { activeLocations: active, crowded },
  };
}

export async function getExceptionsCard(input: { organizationId: string }): Promise<ReadModelEnvelope<{ exceptions: string[] }>> {
  const now = new Date();
  const exceptions: string[] = [];
  // Collect from various sources
  for (const exp of memoryStore.expenses.values()) {
    if (exp.organizationId !== input.organizationId) continue;
    if ((exp as any).flaggedReason) exceptions.push(`Expense ${exp.id} flagged ${ (exp as any).flaggedReason }`);
  }
  for (const pay of memoryStore.payments.values()) {
    if (pay.organizationId !== input.organizationId) continue;
    if (pay.status === "PENDING_VERIFICATION") {
      const ageH = (now.getTime() - pay.createdAt.getTime()) / 3600000;
      if (ageH > 24) exceptions.push(`Payment ${pay.id} pending verification >24h`);
    }
  }
  return {
    computedAt: now,
    freshnessBand: freshnessBand(now),
    value: { exceptions: exceptions.slice(0, 20) },
  };
}

export interface OutletDashboardSummary {
  readonly outletId: string;
  readonly stallId: string;
  readonly stallCode: string;
  readonly sellingLocationId: string;
  readonly locationName: string;
  readonly outletName: string;
  readonly operatorId: string;
  readonly operatorName: string;
  readonly shiftId: string;
  readonly shiftStatus: string;
  readonly transactionCount: number;
  readonly totalSales: Money;
  readonly cashSales: Money;
  readonly digitalVerifiedSales: Money;
  readonly digitalUnverifiedSales: Money;
  readonly expenseCount: number;
  readonly totalExpenses: Money;
  readonly cashBoxExpenses: Money;
  readonly lastActivityAt?: string;
}

export interface DashboardActivityItem {
  readonly id: string;
  readonly kind: "SALE" | "EXPENSE" | "AUDIT";
  readonly saleId?: string;
  readonly paymentId?: string;
  readonly expenseId?: string;
  readonly categoryCode?: string;
  readonly paidFrom?: "CASH_BOX" | "PERSONAL";
  readonly flaggedReason?: string;
  readonly description?: string;
  readonly outletId: string;
  readonly stallCode: string;
  readonly locationName: string;
  readonly outletName: string;
  readonly operatorName: string;
  readonly amount: Money;
  readonly paymentMethod: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly note?: string;
  readonly occurredAt: string;
  readonly serverAcceptedAt: string;
}

export interface DashboardReadModel {
  readonly computedAt: string;
  readonly freshnessBand: "current" | "recent" | "stale";
  readonly businessDay: string;
  readonly sales: {
    readonly totalSales: Money;
    readonly count: number;
    readonly grossByMethod: {
      readonly CASH: Money;
      readonly DIGITAL_VERIFIED: Money;
      readonly DIGITAL_UNVERIFIED: Money;
    };
  };
  readonly expenses: {
    readonly totalExpenses: Money;
    readonly cashBoxExpenses: Money;
    readonly personalExpenses: Money;
    readonly count: number;
    readonly pendingReviewCount: number;
    readonly flaggedCount: number;
  };
  readonly coverage: {
    readonly shiftsActive: number;
    readonly shiftsWithoutLocationReport: number;
    readonly stallsIdle: number;
    readonly activeShifts: readonly {
      readonly shiftId: string;
      readonly stallCode: string;
      readonly operatorName: string;
      readonly locationName: string;
      readonly openingCash: Money;
    }[];
  };
  readonly cashPosition: {
    readonly openingCash: Money;
    readonly cashSales: Money;
    readonly cashExpenses: Money;
    readonly expectedCash: Money;
    readonly countedCash: Money;
    readonly varianceAmount: Money;
    readonly unresolvedVerificationsCount: number;
  };
  readonly verificationBacklog: {
    readonly pendingCount: number;
    readonly pendingAmountUnverified: Money;
    readonly oldestAgeHours: number;
  };
  readonly expenseReview: {
    readonly pending: number;
    readonly flagged: number;
    readonly count: number;
    readonly totalExpenses: Money;
    readonly cashBoxExpenses: Money;
    readonly personalExpenses: Money;
  };
  readonly incidents: {
    readonly open: number;
    readonly critical: number;
  };
  readonly closings: {
    readonly submitted: number;
    readonly missing: number;
  };
  readonly locations: {
    readonly activeLocations: number;
    readonly crowded: number;
    readonly primaryLocationName: string;
  };
  readonly exceptions: {
    readonly total: number;
    readonly items: readonly string[];
  };
  readonly stock: {
    readonly low: number;
    readonly habis: number;
    readonly items: readonly {
      readonly stockItemId: string;
      readonly code: string;
      readonly name: string;
      readonly unit: string;
      readonly currentQty: number;
    }[];
  };
  readonly outlets: readonly OutletDashboardSummary[];
  readonly recentActivity: readonly DashboardActivityItem[];
  readonly authorizedOutlets: readonly AuthorizedOutletInfo[];
}

export async function getDashboardReadModel(
  session: SessionContext,
  options?: { businessDay?: string; activityLimit?: number }
): Promise<DashboardReadModel> {
  syncFromDiskIfNeeded();
  if (!session || !session.organizationId) {
    throw Object.assign(new Error("Unauthenticated"), { code: "UNAUTHENTICATED", status: 401 });
  }

  // Verify view permission (hq:view or sale:view)
  const canViewHq = session.roles.some(r =>
    ["OWNER", "HQ_OPS", "HQ_FINANCE", "AREA_SUPERVISOR", "MENU_PRICING_ADMIN", "ANALYST", "AUDITOR", "OPERATOR"].includes(r)
  );
  if (!canViewHq) {
    authorize(session, "hq:view", session.scope);
  }

  const now = new Date();
  const businessDay = options?.businessDay || toJakartanBusinessDay(now);
  const activityLimit = options?.activityLimit ?? 20;

  const authorizedOutlets = await getAuthorizedOutlets(session);
  const authorizedStallIds = new Set(authorizedOutlets.map(o => o.stallId));

  const { items: scopedSales } = await repositories.sales.list(session.scope);
  const { items: scopedPayments } = await repositories.payments.list(session.scope);
  const { items: scopedShifts } = await repositories.shifts.list(session.scope);
  const { items: scopedExpenses } = await repositories.expenses.list(session.scope);

  // Index payments by saleId
  const paymentBySaleId = new Map<string, (typeof scopedPayments)[number]>();
  for (const p of scopedPayments) {
    paymentBySaleId.set(p.saleId, p);
  }

  // Sales KPIs
  let completedSalesCount = 0;
  let totalCompletedMinor = 0;
  let cashPaidMinor = 0;
  let digitalVerifiedMinor = 0;
  let digitalUnverifiedMinor = 0;

  for (const sale of scopedSales) {
    if (session.scope.kind !== "org" && authorizedStallIds.size > 0 && !authorizedStallIds.has(sale.stallId)) {
      continue;
    }
    const pay = paymentBySaleId.get(sale.id);
    if (sale.status === "COMPLETED") {
      completedSalesCount += 1;
      totalCompletedMinor += sale.totalMinor;
      if (!pay || pay.method === "CASH") {
        cashPaidMinor += sale.totalMinor;
      } else if (pay.status === "PAID") {
        digitalVerifiedMinor += pay.amountMinor;
      }
    } else if (pay && pay.status === "PENDING_VERIFICATION") {
      digitalUnverifiedMinor += pay.amountMinor;
    }
  }

  // Coverage & Active shifts
  const openShifts = scopedShifts.filter(s => s.status === "OPEN" || s.status === "PENDING_SYNC");
  let shiftsWithoutLocationReport = 0;
  const activeShiftsList = openShifts.map(sh => {
    const hasLoc = Array.from(memoryStore.locationReports.values()).some(
      lr => lr.shiftId === sh.id && !lr.departedAt
    );
    if (!hasLoc) shiftsWithoutLocationReport += 1;
    const stall = memoryStore.stalls.get(sh.stallId);
    const op = memoryStore.operators.get(sh.operatorId);
    const loc = memoryStore.sellingLocations.get(sh.startLocationId);
    return {
      shiftId: sh.id,
      stallCode: stall?.code || "ST-001",
      operatorName: op?.name || "Operator",
      locationName: loc?.name || "Lokasi",
      openingCash: money(sh.openingCashMinor, "IDR"),
    };
  });

  const { items: scopedStalls } = await repositories.stalls.list(session.scope);
  const stallsIdle = scopedStalls.filter(
    st => st.status === "ACTIVE" && !openShifts.some(sh => sh.stallId === st.id)
  ).length;

  // Expenses (scoped)
  const visibleExpenses = scopedExpenses.filter(e => {
    if (session.scope.kind === "org" || authorizedStallIds.size === 0) return true;
    const expStallId = e.stallId || memoryStore.shifts.get(e.shiftId)?.stallId;
    return expStallId ? authorizedStallIds.has(expStallId) : true;
  });
  const activeExpenses = visibleExpenses.filter(e => e.reviewStatus !== "REJECTED");
  const cashExpensesMinor = activeExpenses
    .filter(e => e.paidFrom === "CASH_BOX")
    .reduce((sum, e) => sum + e.amountMinor, 0);
  const personalExpensesMinor = activeExpenses
    .filter(e => e.paidFrom === "PERSONAL")
    .reduce((sum, e) => sum + e.amountMinor, 0);
  const totalExpensesMinor = activeExpenses.reduce((sum, e) => sum + e.amountMinor, 0);
  const expenseCount = activeExpenses.length;
  const pendingExpenses = visibleExpenses.filter(
    e => e.reviewStatus === "SUBMITTED" || e.reviewStatus === "REVIEW_REQUIRED"
  ).length;
  const flaggedExpenses = visibleExpenses.filter(e => Boolean(e.flaggedReason)).length;

  // Cash position
  const openingCashMinor = openShifts.reduce((sum, sh) => sum + sh.openingCashMinor, 0);
  const expectedCashMinor = openingCashMinor + cashPaidMinor - cashExpensesMinor;

  // Verification backlog
  const pendingVerifications = scopedPayments.filter(
    p => p.status === "PENDING_VERIFICATION" || p.status === "PENDING"
  );
  let oldestPendingDate: Date | null = null;
  for (const p of pendingVerifications) {
    if (!oldestPendingDate || p.createdAt < oldestPendingDate) {
      oldestPendingDate = p.createdAt;
    }
  }
  const oldestAgeHours = oldestPendingDate
    ? (now.getTime() - oldestPendingDate.getTime()) / 3600000
    : 0;

  // Stock
  const stockItems = Array.from(memoryStore.stockItems.values())
    .filter(s => s.organizationId === session.organizationId && s.active)
    .map(item => {
      const movements = Array.from(memoryStore.stockMovements.values()).filter(
        m => m.organizationId === session.organizationId && m.stockItemId === item.id
      );
      const currentQty = movements.reduce((sum, m) => sum + m.quantity, 0);
      return {
        stockItemId: item.id,
        code: item.code,
        name: item.name,
        unit: item.unit,
        currentQty,
      };
    });
  const lowStockCount = stockItems.filter(i => i.currentQty > 0 && i.currentQty < 10).length;
  const outOfStockCount = stockItems.filter(i => i.currentQty <= 0).length;

  // Per-outlet aggregation
  const outlets: OutletDashboardSummary[] = authorizedOutlets.map(outlet => {
    const outletSales = scopedSales.filter(s => s.stallId === outlet.stallId);
    let outletTxCount = 0;
    let outletTotalMinor = 0;
    let outletCashMinor = 0;
    let outletDigVerifiedMinor = 0;
    let outletDigUnverifiedMinor = 0;
    let latestTime: Date | null = null;

    for (const s of outletSales) {
      const pay = paymentBySaleId.get(s.id);
      if (!latestTime || s.serverAcceptedAt > latestTime) {
        latestTime = s.serverAcceptedAt;
      }
      if (s.status === "COMPLETED") {
        outletTxCount += 1;
        outletTotalMinor += s.totalMinor;
        if (!pay || pay.method === "CASH") {
          outletCashMinor += s.totalMinor;
        } else if (pay.status === "PAID") {
          outletDigVerifiedMinor += pay.amountMinor;
        }
      } else if (pay && pay.status === "PENDING_VERIFICATION") {
        outletDigUnverifiedMinor += pay.amountMinor;
      }
    }

    const outletExpenseList = activeExpenses.filter(e => {
      const expStallId = e.stallId || memoryStore.shifts.get(e.shiftId)?.stallId;
      return expStallId === outlet.stallId || e.shiftId === outlet.shiftId;
    });
    for (const e of outletExpenseList) {
      if (!latestTime || e.createdAt > latestTime) {
        latestTime = e.createdAt;
      }
    }
    const outletExpenseCount = outletExpenseList.length;
    const outletExpensesMinor = outletExpenseList.reduce((sum, e) => sum + e.amountMinor, 0);
    const outletCashBoxExpensesMinor = outletExpenseList
      .filter(e => e.paidFrom === "CASH_BOX")
      .reduce((sum, e) => sum + e.amountMinor, 0);

    return {
      outletId: outlet.outletId,
      stallId: outlet.stallId,
      stallCode: outlet.stallCode,
      sellingLocationId: outlet.sellingLocationId,
      locationName: outlet.locationName,
      outletName: outlet.outletName,
      operatorId: outlet.operatorId,
      operatorName: outlet.operatorName,
      shiftId: outlet.shiftId,
      shiftStatus: outlet.shiftStatus,
      transactionCount: outletTxCount,
      totalSales: money(outletTotalMinor, "IDR"),
      cashSales: money(outletCashMinor, "IDR"),
      digitalVerifiedSales: money(outletDigVerifiedMinor, "IDR"),
      digitalUnverifiedSales: money(outletDigUnverifiedMinor, "IDR"),
      expenseCount: outletExpenseCount,
      totalExpenses: money(outletExpensesMinor, "IDR"),
      cashBoxExpenses: money(outletCashBoxExpensesMinor, "IDR"),
      lastActivityAt: latestTime ? latestTime.toISOString() : undefined,
    };
  });

  // Unified Recent Activity Feed (derived from persisted sales + expenses)
  const saleActivities: DashboardActivityItem[] = scopedSales.map(sale => {
    const stall = memoryStore.stalls.get(sale.stallId);
    const loc = memoryStore.sellingLocations.get(sale.sellingLocationId);
    const op = memoryStore.operators.get(sale.operatorId);
    const pay = paymentBySaleId.get(sale.id);
    const stallCode = stall?.code || "ST-001";
    const locationName = loc?.name || "Alun-alun Bandung";
    return {
      id: sale.id,
      kind: "SALE" as const,
      saleId: sale.id,
      paymentId: pay?.id,
      outletId: sale.stallId,
      stallCode,
      locationName,
      outletName: `${stallCode} — ${locationName}`,
      operatorName: op?.name || "Operator",
      amount: money(sale.totalMinor, "IDR"),
      paymentMethod: pay?.method || "CASH",
      status: sale.status,
      paymentStatus: pay?.status || (sale.status === "COMPLETED" ? "PAID" : "PENDING_VERIFICATION"),
      note: sale.note || sale.customerReference,
      occurredAt: sale.occurredAt.toISOString(),
      serverAcceptedAt: sale.serverAcceptedAt.toISOString(),
    };
  });

  const expenseActivities: DashboardActivityItem[] = visibleExpenses.map(exp => {
    const shift = memoryStore.shifts.get(exp.shiftId);
    const expStallId = exp.stallId || shift?.stallId || "00000000-0000-7000-0000-000000000020";
    const expLocId = exp.sellingLocationId || shift?.startLocationId || "00000000-0000-7000-0000-000000000030";
    const stall = memoryStore.stalls.get(expStallId);
    const loc = memoryStore.sellingLocations.get(expLocId);
    const op = memoryStore.operators.get(exp.operatorId);
    const stallCode = stall?.code || "ST-001";
    const locationName = loc?.name || "Alun-alun Bandung";
    const combinedNote = exp.note ? `${exp.description} (${exp.note})` : exp.description;
    return {
      id: exp.id,
      kind: "EXPENSE" as const,
      expenseId: exp.id,
      categoryCode: exp.category,
      paidFrom: exp.paidFrom,
      flaggedReason: exp.flaggedReason,
      description: exp.description,
      outletId: expStallId,
      stallCode,
      locationName,
      outletName: `${stallCode} — ${locationName}`,
      operatorName: op?.name || "Operator",
      amount: money(exp.amountMinor, "IDR"),
      paymentMethod: exp.paidFrom,
      status: exp.reviewStatus,
      paymentStatus: exp.reviewStatus,
      note: combinedNote,
      occurredAt: exp.incurredAt.toISOString(),
      serverAcceptedAt: exp.createdAt.toISOString(),
    };
  });

  const recentActivity: DashboardActivityItem[] = [...saleActivities, ...expenseActivities]
    .sort((a, b) => {
      const diff = new Date(b.serverAcceptedAt).getTime() - new Date(a.serverAcceptedAt).getTime();
      if (diff !== 0) return diff;
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    })
    .slice(0, activityLimit);

  // Incidents, Closings, Locations, Exceptions
  const incidentsCard = await getIncidentBoardCard({ organizationId: session.organizationId });
  const closingsCard = await getClosingCompletenessCard({
    organizationId: session.organizationId,
    businessDay: businessDay as BusinessDay,
  });
  const locationsCard = await getLocationUsageCard({ organizationId: session.organizationId });
  const exceptionsCard = await getExceptionsCard({ organizationId: session.organizationId });

  return {
    computedAt: now.toISOString(),
    freshnessBand: freshnessBand(now),
    businessDay,
    sales: {
      totalSales: money(totalCompletedMinor, "IDR"),
      count: completedSalesCount,
      grossByMethod: {
        CASH: money(cashPaidMinor, "IDR"),
        DIGITAL_VERIFIED: money(digitalVerifiedMinor, "IDR"),
        DIGITAL_UNVERIFIED: money(digitalUnverifiedMinor, "IDR"),
      },
    },
    expenses: {
      totalExpenses: money(totalExpensesMinor, "IDR"),
      cashBoxExpenses: money(cashExpensesMinor, "IDR"),
      personalExpenses: money(personalExpensesMinor, "IDR"),
      count: expenseCount,
      pendingReviewCount: pendingExpenses,
      flaggedCount: flaggedExpenses,
    },
    coverage: {
      shiftsActive: openShifts.length,
      shiftsWithoutLocationReport,
      stallsIdle,
      activeShifts: activeShiftsList,
    },
    cashPosition: {
      openingCash: money(openingCashMinor, "IDR"),
      cashSales: money(cashPaidMinor, "IDR"),
      cashExpenses: money(cashExpensesMinor, "IDR"),
      expectedCash: money(expectedCashMinor, "IDR"),
      countedCash: money(expectedCashMinor, "IDR"),
      varianceAmount: money(0, "IDR"),
      unresolvedVerificationsCount: pendingVerifications.length,
    },
    verificationBacklog: {
      pendingCount: pendingVerifications.length,
      pendingAmountUnverified: money(digitalUnverifiedMinor, "IDR"),
      oldestAgeHours,
    },
    expenseReview: {
      pending: pendingExpenses,
      flagged: flaggedExpenses,
      count: expenseCount,
      totalExpenses: money(totalExpensesMinor, "IDR"),
      cashBoxExpenses: money(cashExpensesMinor, "IDR"),
      personalExpenses: money(personalExpensesMinor, "IDR"),
    },
    incidents: incidentsCard.value,
    closings: closingsCard.value,
    locations: {
      activeLocations: locationsCard.value.activeLocations,
      crowded: locationsCard.value.crowded,
      primaryLocationName: authorizedOutlets[0]?.locationName || "Alun-alun Bandung",
    },
    exceptions: {
      total: exceptionsCard.value.exceptions.length,
      items: exceptionsCard.value.exceptions,
    },
    stock: {
      low: lowStockCount,
      habis: outOfStockCount,
      items: stockItems,
    },
    outlets,
    recentActivity,
    authorizedOutlets,
  };
}

// Server-side dashboard read model (T-HQ-002 read layer).
export * from "./dashboard";

