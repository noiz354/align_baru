import { memoryStore, type StoredExpense } from "@/server/db/memory-store";
import type { SessionContext } from "@/server/auth/port";
import type { Scope } from "@/shared/types/scope";
import type { ExpenseCategoryCode, ExpensePaidFrom, ExpenseReviewState } from "@/domain/expense/review";

export interface ExpenseFilters {
  businessDay?: string;
  stallId?: string;
  category?: ExpenseCategoryCode;
  reviewStatus?: ExpenseReviewState;
  paidFrom?: ExpensePaidFrom;
  limit?: number;
  offset?: number;
}

export interface ExpenseRow {
  id: string;
  businessDay: string;
  incurredAt: string;
  submittedAt: string;
  shiftId: string;
  stallId: string;
  outletName: string;
  category: ExpenseCategoryCode;
  amountMinor: number;
  currency: "IDR";
  paidFrom: ExpensePaidFrom;
  cashImpact: "REDUCES_EXPECTED_CASH" | "NONE";
  description: string | null;
  note: string | null;
  reviewStatus: ExpenseReviewState;
  flaggedReason: string | null;
}

export interface ExpenseDetail extends ExpenseRow {
  evidenceAvailableInThisRuntime: false;
}

function isExpenseReviewState(value: string): value is ExpenseReviewState {
  return ["SUBMITTED", "REVIEW_REQUIRED", "REVIEWED", "REJECTED", "ESCALATED"].includes(value);
}

function withinExpenseScope(expense: StoredExpense, session: SessionContext): boolean {
  if (expense.organizationId !== session.organizationId) return false;
  const shift = memoryStore.shifts.get(expense.shiftId);
  if (!shift || shift.organizationId !== session.organizationId) return false;
  const stall = memoryStore.stalls.get(shift.stallId);
  if (!stall || stall.organizationId !== session.organizationId) return false;
  if (session.scope.kind === "self") {
    return shift.operatorId === session.scope.operatorId && expense.operatorId === session.scope.operatorId;
  }
  if (session.scope.kind === "stall") return shift.stallId === session.scope.stallId;
  if (session.scope.kind === "area") return stall.areaId === session.scope.areaId;
  if (session.scope.kind === "region") return false; // Region membership is not represented by this store; fail closed.
  return true;
}

function toRow(expense: StoredExpense): ExpenseRow | null {
  const shift = memoryStore.shifts.get(expense.shiftId);
  const stall = shift ? memoryStore.stalls.get(shift.stallId) : undefined;
  if (!shift || !stall || !isExpenseReviewState(expense.reviewStatus)) return null;
  return {
    id: expense.id,
    businessDay: shift.businessDay,
    incurredAt: expense.incurredAt.toISOString(),
    submittedAt: expense.createdAt.toISOString(),
    shiftId: shift.id,
    stallId: stall.id,
    outletName: stall.code,
    category: expense.category as ExpenseCategoryCode,
    amountMinor: expense.amountMinor,
    currency: expense.currency,
    paidFrom: expense.paidFrom,
    cashImpact: expense.paidFrom === "CASH_BOX" ? "REDUCES_EXPECTED_CASH" : "NONE",
    description: expense.description.trim() ? expense.description : null,
    note: expense.note?.trim() ? expense.note : null,
    reviewStatus: expense.reviewStatus,
    flaggedReason: expense.flaggedReason ?? null,
  };
}

function accessibleOutlets(session: SessionContext): Array<{ id: string; name: string }> {
  const stallIds = new Set(Array.from(memoryStore.shifts.values())
    .filter((shift) => shift.organizationId === session.organizationId)
    .filter((shift) => {
      if (session.scope.kind === "self") return shift.operatorId === session.scope.operatorId;
      if (session.scope.kind === "stall") return shift.stallId === session.scope.stallId;
      if (session.scope.kind === "region") return false;
      if (session.scope.kind === "area") return memoryStore.stalls.get(shift.stallId)?.areaId === session.scope.areaId;
      return true;
    })
    .map((shift) => shift.stallId));
  return Array.from(stallIds)
    .map((stallId) => memoryStore.stalls.get(stallId))
    .filter((stall): stall is NonNullable<typeof stall> => Boolean(stall) && stall?.organizationId === session.organizationId)
    .map((stall) => ({ id: stall.id, name: stall.code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listExpenses(session: SessionContext, filters: ExpenseFilters = {}): {
  data: ExpenseRow[];
  total: number;
  limit: number;
  offset: number;
  outlets: Array<{ id: string; name: string }>;
} {
  const limit = Math.max(1, Math.min(filters.limit ?? 25, 100));
  const offset = Math.max(0, filters.offset ?? 0);
  const records = Array.from(memoryStore.expenses.values())
    .filter((expense) => withinExpenseScope(expense, session))
    .filter((expense) => !filters.stallId || memoryStore.shifts.get(expense.shiftId)?.stallId === filters.stallId)
    .filter((expense) => !filters.businessDay || memoryStore.shifts.get(expense.shiftId)?.businessDay === filters.businessDay)
    .filter((expense) => !filters.category || expense.category === filters.category)
    .filter((expense) => !filters.reviewStatus || expense.reviewStatus === filters.reviewStatus)
    .filter((expense) => !filters.paidFrom || expense.paidFrom === filters.paidFrom)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id));
  const data = records.map(toRow).filter((row): row is ExpenseRow => row !== null);
  return { data: data.slice(offset, offset + limit), total: data.length, limit, offset, outlets: accessibleOutlets(session) };
}

export function getExpense(session: SessionContext, expenseId: string): ExpenseDetail | null {
  const expense = memoryStore.expenses.get(expenseId);
  if (!expense || !withinExpenseScope(expense, session)) return null;
  const row = toRow(expense);
  return row ? { ...row, evidenceAvailableInThisRuntime: false } : null;
}

export function canAccessExpense(session: SessionContext, expenseId: string): boolean {
  const expense = memoryStore.expenses.get(expenseId);
  return Boolean(expense && withinExpenseScope(expense, session));
}

export function expenseScopeForShift(shiftId: string, organizationId: string): Scope | null {
  const shift = memoryStore.shifts.get(shiftId);
  if (!shift || shift.organizationId !== organizationId) return null;
  const stall = memoryStore.stalls.get(shift.stallId);
  if (!stall || stall.organizationId !== organizationId) return null;
  return { kind: "stall", organizationId, stallId: stall.id, areaId: stall.areaId };
}

export function canAccessExpenseShift(session: SessionContext, shiftId: string): boolean {
  const shift = memoryStore.shifts.get(shiftId);
  if (!shift || shift.organizationId !== session.organizationId) return false;
  const stall = memoryStore.stalls.get(shift.stallId);
  if (!stall || stall.organizationId !== session.organizationId) return false;
  if (session.scope.kind === "self") return shift.operatorId === session.scope.operatorId;
  if (session.scope.kind === "stall") return shift.stallId === session.scope.stallId;
  if (session.scope.kind === "area") return stall.areaId === session.scope.areaId;
  if (session.scope.kind === "region") return false;
  return true;
}
