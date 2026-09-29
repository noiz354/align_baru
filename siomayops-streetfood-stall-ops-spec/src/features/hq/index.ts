import { memoryStore } from "../../server/db/memory-store";
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
  // MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
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
  // MOCK ONLY — TEMPORARY SERVER ADAPTER — REPLACE WITH REAL DOMAIN/PERSISTENCE
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
