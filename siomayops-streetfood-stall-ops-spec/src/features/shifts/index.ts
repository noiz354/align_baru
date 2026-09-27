import { memoryStore, generateId } from "../../server/db/memory-store";
import type { ShiftId, StallId, OperatorId, SellingLocationId, ClosingId } from "../../shared/types/ids";
import type { ShiftStatus } from "../../domain/shift";
import { assertShiftTransition } from "../../domain/shift/state";
import { prepareShiftClosing as domainPrepareClosing, computeCashVariance } from "../../domain/shift/expected-cash";
import { toBusinessDay, DEFAULT_BUSINESS_DAY_CONFIG } from "../../shared/time/business-day";
import { money, type Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { reportLocation } from "../locations";

export interface ShiftSummary {
  readonly shiftId: ShiftId;
  readonly status: ShiftStatus;
  readonly businessDay: string;
  readonly stallId: StallId;
  readonly operatorId: OperatorId;
  readonly openingCash?: Money;
  readonly expectedCash: Money;
  readonly version: number;
  readonly organizationId: string;
}

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export async function startShift(input: {
  operatorId: OperatorId; stallId: StallId; sellingLocationId: SellingLocationId;
  openingCash?: Money; startingStock: readonly { stockItemId: string; quantity: number }[];
  clientShiftId: string; plannedShiftId?: string; organizationId?: string;
}): Promise<ShiftSummary> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Idempotency: check clientShiftId
  const existingId = memoryStore.shiftByClientId.get(input.clientShiftId);
  if (existingId) {
    const existing = memoryStore.shifts.get(existingId);
    if (existing) {
      return {
        shiftId: existing.id,
        status: existing.status as ShiftStatus,
        businessDay: existing.businessDay,
        stallId: existing.stallId,
        operatorId: existing.operatorId,
        openingCash: money(existing.openingCashMinor, existing.currency),
        expectedCash: money(existing.openingCashMinor, existing.currency),
        version: existing.version,
        organizationId: existing.organizationId,
      };
    }
  }

  // Check operator status
  const operator = memoryStore.operators.get(input.operatorId);
  if (operator && operator.status === "SUSPENDED") {
    throw Object.assign(new Error("Operator suspended"), { code: "PRECONDITION_FAILED" });
  }
  // Check one active shift per operator
  for (const sh of memoryStore.shifts.values()) {
    if (sh.operatorId === input.operatorId && (sh.status === "OPEN" || sh.status === "PENDING_SYNC")) {
      throw Object.assign(new Error("Operator already has active shift"), { code: "CONFLICT" });
    }
    if (sh.stallId === input.stallId && (sh.status === "OPEN" || sh.status === "PENDING_SYNC")) {
      throw Object.assign(new Error("Stall already has active shift"), { code: "CONFLICT" });
    }
  }
  // Check location not restricted
  const loc = memoryStore.sellingLocations.get(input.sellingLocationId);
  if (!loc) throw Object.assign(new Error("Location not found"), { code: "NOT_FOUND" });
  if (loc.status === "RESTRICTED" || loc.status === "INACTIVE") {
    throw Object.assign(new Error(`Location ${loc.status}`), { code: "PRECONDITION_FAILED" });
  }

  const now = new Date();
  const businessDay = toBusinessDay(now, DEFAULT_BUSINESS_DAY_CONFIG);
  const shiftId = generateId();
  const openingCashMinor = input.openingCash?.amountMinor ?? 0;

  const shiftRecord = {
    id: shiftId,
    organizationId: orgId,
    operatorId: input.operatorId,
    stallId: input.stallId,
    businessDay,
    startedAt: now,
    startLocationId: input.sellingLocationId,
    openingCashMinor,
    currency: "IDR" as const,
    status: "OPEN" as const,
    clientShiftId: input.clientShiftId,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  memoryStore.shifts.set(shiftId, shiftRecord);
  memoryStore.shiftByClientId.set(input.clientShiftId, shiftId);

  // Create starting stock snapshots
  for (const item of input.startingStock) {
    const snapId = generateId();
    memoryStore.stockSnapshots.set(snapId, {
      id: snapId,
      organizationId: orgId,
      shiftId,
      stockItemId: item.stockItemId,
      phase: "START",
      countedQuantity: item.quantity,
      expectedQuantity: item.quantity,
    });
  }

  // Create first location report
  const clientReportId = generateId();
  await reportLocation({
    shiftId,
    sellingLocationId: input.sellingLocationId,
    trigger: "ARRIVED",
    clientReportId,
    operatorId: input.operatorId,
    organizationId: orgId,
  });

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: "OPERATOR",
    actorId: input.operatorId,
    action: "shift.started",
    subjectKind: "shift",
    subjectId: shiftId,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { stallId: input.stallId, locationId: input.sellingLocationId, openingCash: openingCashMinor },
  });

  return {
    shiftId,
    status: "OPEN",
    businessDay,
    stallId: input.stallId,
    operatorId: input.operatorId,
    openingCash: money(openingCashMinor, "IDR"),
    expectedCash: money(openingCashMinor, "IDR"),
    version: 1,
    organizationId: orgId,
  };
}

export async function suspendShift(input: { shiftId: ShiftId; reason: string; actorId?: string }): Promise<ShiftSummary> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  assertShiftTransition(shift.status as ShiftStatus, "SUSPENDED", input.reason);
  const prev = shift.status;
  shift.status = "SUSPENDED";
  shift.updatedAt = new Date();
  shift.version += 1;
  memoryStore.shifts.set(shift.id, shift);
  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "HQ_USER",
    actorId: input.actorId,
    action: "shift.suspended",
    subjectKind: "shift",
    subjectId: shift.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: "SUSPENDED" },
  });
  return {
    shiftId: shift.id,
    status: shift.status as ShiftStatus,
    businessDay: shift.businessDay,
    stallId: shift.stallId,
    operatorId: shift.operatorId,
    openingCash: money(shift.openingCashMinor, shift.currency),
    expectedCash: money(shift.openingCashMinor, shift.currency),
    version: shift.version,
    organizationId: shift.organizationId,
  };
}

export async function prepareShiftClosing(input: { shiftId: ShiftId }): Promise<{
  readonly expectedCash: Money; readonly cashSalesTotal: Money; readonly cashExpensesTotal: Money;
  readonly unresolvedVerifications: number;
}> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });

  let cashSalesMinor = 0;
  let cashExpensesMinor = 0;
  let digitalExpectedMinor = 0;
  let unresolved = 0;

  for (const sale of memoryStore.sales.values()) {
    if (sale.shiftId !== input.shiftId) continue;
    // Find payment
    for (const pay of memoryStore.payments.values()) {
      if (pay.saleId === sale.id) {
        if (pay.method === "CASH" && pay.status === "PAID") {
          cashSalesMinor += pay.amountMinor;
        } else if (pay.method !== "CASH") {
          digitalExpectedMinor += pay.amountMinor;
          if (pay.status === "PENDING_VERIFICATION" || pay.status === "PENDING") unresolved++;
        }
      }
    }
  }

  for (const exp of memoryStore.expenses.values()) {
    if (exp.shiftId !== input.shiftId) continue;
    if (exp.paidFrom === "CASH_BOX") {
      cashExpensesMinor += exp.amountMinor;
    }
  }

  const openingCash = money(shift.openingCashMinor, "IDR");
  const cashSalesTotal = money(cashSalesMinor, "IDR");
  const cashExpensesTotal = money(cashExpensesMinor, "IDR");

  const breakdown = domainPrepareClosing({
    openingCash,
    cashSalesTotal,
    cashExpensesTotal,
  });

  return {
    expectedCash: breakdown.expected,
    cashSalesTotal,
    cashExpensesTotal,
    unresolvedVerifications: unresolved,
  };
}

export async function submitShiftClosing(input: {
  shiftId: ShiftId; countedCash: Money; varianceReason?: string; varianceNote?: string;
  stockCounts: readonly { stockItemId: string; countedQuantity: number | null; reason?: string }[];
  clientClosingId: string; organizationId?: string;
}): Promise<{ readonly closingId: ClosingId; readonly status: "PENDING_SYNC" | "CLOSING_SUBMITTED" }> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  // Idempotency
  const existingClosingId = memoryStore.closingByClientId.get(input.clientClosingId);
  if (existingClosingId) {
    const existing = memoryStore.closings.get(existingClosingId);
    if (existing) {
      return { closingId: existing.id, status: existing.status as any };
    }
  }

  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC" && shift.status !== "SUSPENDED") {
    throw Object.assign(new Error(`Cannot close shift in status ${shift.status}`), { code: "INVALID_TRANSITION" });
  }

  const prepared = await prepareShiftClosing({ shiftId: input.shiftId });
  const variance = computeCashVariance(prepared.expectedCash, input.countedCash);

  // Tolerance check could be added, but for now always allow

  const closingId = generateId();
  const now = new Date();
  const closing = {
    id: closingId,
    organizationId: shift.organizationId,
    shiftId: input.shiftId,
    submittedAt: now,
    openingCashMinor: shift.openingCashMinor,
    cashSalesMinor: prepared.cashSalesTotal.amountMinor,
    cashExpensesMinor: prepared.cashExpensesTotal.amountMinor,
    expectedCashMinor: prepared.expectedCash.amountMinor,
    countedCashMinor: input.countedCash.amountMinor,
    cashVarianceMinor: variance.amountMinor,
    digitalExpectedMinor: 0,
    digitalReceivedMinor: 0,
    notes: input.varianceNote,
    status: "CLOSING_SUBMITTED" as const,
    clientClosingId: input.clientClosingId,
  };
  memoryStore.closings.set(closingId, closing);
  memoryStore.closingByClientId.set(input.clientClosingId, closingId);

  // Stock END snapshots
  for (const sc of input.stockCounts) {
    const snapId = generateId();
    memoryStore.stockSnapshots.set(snapId, {
      id: snapId,
      organizationId: shift.organizationId,
      shiftId: input.shiftId,
      stockItemId: sc.stockItemId,
      phase: "END",
      countedQuantity: sc.countedQuantity,
      expectedQuantity: undefined,
      varianceQuantity: undefined,
      reason: sc.reason,
    });
  }

  // Transition shift
  try {
    assertShiftTransition(shift.status as ShiftStatus, "CLOSING_SUBMITTED");
  } catch {
    // If from SUSPENDED, allowed
    assertShiftTransition(shift.status as ShiftStatus, "CLOSING_SUBMITTED", "closing");
  }
  shift.status = "CLOSING_SUBMITTED";
  shift.endedAt = now;
  shift.version += 1;
  shift.updatedAt = now;
  memoryStore.shifts.set(shift.id, shift);

  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "OPERATOR",
    actorId: shift.operatorId,
    action: "shift.closed",
    subjectKind: "shift",
    subjectId: shift.id,
    reason: input.varianceReason,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { countedCash: input.countedCash.amountMinor, expected: prepared.expectedCash.amountMinor, variance: variance.amountMinor },
  });

  return { closingId, status: "CLOSING_SUBMITTED" };
}

export async function handoverShift(input: {
  shiftId: ShiftId; incomingOperatorId: OperatorId; carryOverCashCounted: Money;
  openIssuesNote?: string; outgoingConfirmed: boolean; incomingConfirmed: boolean;
}): Promise<{ readonly handoverId: string; readonly status: "COMPLETED" | "CANCELLED" | "DISPUTED" }> {
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });
  if (!input.outgoingConfirmed || !input.incomingConfirmed) {
    return { handoverId: generateId(), status: "CANCELLED" };
  }
  const handoverId = generateId();
  // For simplicity, we just transfer operator
  const prevOperator = shift.operatorId;
  shift.operatorId = input.incomingOperatorId;
  shift.version += 1;
  shift.updatedAt = new Date();
  memoryStore.shifts.set(shift.id, shift);

  await writeAuditEvent({
    organizationId: shift.organizationId,
    actorKind: "OPERATOR",
    actorId: prevOperator,
    action: "shift.handover",
    subjectKind: "shift",
    subjectId: shift.id,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { operatorId: prevOperator },
    afterSummary: { operatorId: input.incomingOperatorId, cashCounted: input.carryOverCashCounted.amountMinor },
  });

  return { handoverId, status: "COMPLETED" };
}

export async function getShiftById(shiftId: string): Promise<ShiftSummary | null> {
  const shift = memoryStore.shifts.get(shiftId);
  if (!shift) return null;
  const prepared = await prepareShiftClosing({ shiftId }).catch(() => ({ expectedCash: money(shift.openingCashMinor, "IDR") } as any));
  return {
    shiftId: shift.id,
    status: shift.status as ShiftStatus,
    businessDay: shift.businessDay,
    stallId: shift.stallId,
    operatorId: shift.operatorId,
    openingCash: money(shift.openingCashMinor, shift.currency),
    expectedCash: (prepared as any).expectedCash || money(shift.openingCashMinor, shift.currency),
    version: shift.version,
    organizationId: shift.organizationId,
  };
}

export async function listActiveShifts(orgId: string): Promise<ShiftSummary[]> {
  const result: ShiftSummary[] = [];
  for (const shift of memoryStore.shifts.values()) {
    if (shift.organizationId !== orgId) continue;
    if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC" && shift.status !== "SUSPENDED") continue;
    result.push({
      shiftId: shift.id,
      status: shift.status as ShiftStatus,
      businessDay: shift.businessDay,
      stallId: shift.stallId,
      operatorId: shift.operatorId,
      openingCash: money(shift.openingCashMinor, shift.currency),
      expectedCash: money(shift.openingCashMinor, shift.currency),
      version: shift.version,
      organizationId: shift.organizationId,
    });
  }
  return result;
}
