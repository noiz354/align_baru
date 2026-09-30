import { memoryStore, generateId, type StoredExpense } from "../../server/db/memory-store";
import type { Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { EXPENSE_CATEGORY_CODES, nextReviewState, matchesFlagPattern, type ExpenseCategoryCode, type ExpenseRecord, type ExpenseReviewState } from "../../domain/expense/review";
import { money } from "../../shared/money/money";

export * from "./read-model";
export * from "./analytics";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface SubmitExpenseInput {
  shiftId: string;
  categoryId?: string;
  categoryCode?: string;
  description?: string;
  amount: Money;
  paidFrom: "CASH_BOX" | "PERSONAL";
  operatorNote?: string;
  evidenceAssetId?: string;
  clientExpenseId: string;
  recordedAtDevice?: Date;
  sellingLocationId?: string;
  operatorId?: string;
  organizationId?: string;
  actorId?: string;
  actorKind?: "OPERATOR" | "HQ_USER";
}

export async function submitExpense(input: SubmitExpenseInput): Promise<{ expenseId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Client IDs are globally indexed by the current map adapter; prevent cross-tenant replay.
  const existingId = memoryStore.expenseByClientId.get(input.clientExpenseId);
  if (existingId) {
    const existing = memoryStore.expenses.get(existingId);
    if (existing && existing.organizationId !== orgId) {
      throw Object.assign(new Error("Client expense id is already assigned"), { code: "CONFLICT", status: 409 });
    }
    if (existing) {
      const matchesRequest = existing.shiftId === input.shiftId
        && existing.category === (input.categoryCode || "OTHER_OPERATIONAL")
        && existing.amountMinor === input.amount.amountMinor
        && existing.paidFrom === input.paidFrom
        && existing.description === (input.description?.trim() ?? "")
        && (existing.note ?? "") === (input.operatorNote?.trim() ?? "");
      if (!matchesRequest) throw Object.assign(new Error("Client expense id was reused with different data"), { code: "CONFLICT", status: 409 });
      return { expenseId: existing.id };
    }
  }
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift || shift.organizationId !== orgId) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND", status: 404 });
  if (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC") {
    throw Object.assign(new Error("Shift is not open for expense submissions"), { code: "PRECONDITION_FAILED", status: 409 });
  }
  if (!Number.isSafeInteger(input.amount.amountMinor) || input.amount.amountMinor <= 0) {
    throw Object.assign(new Error("Expense amount must be a positive integer"), { code: "VALIDATION_FAILED", status: 400 });
  }

  const candidateCategory = input.categoryCode || "OTHER_OPERATIONAL";
  if (!(EXPENSE_CATEGORY_CODES as readonly string[]).includes(candidateCategory)) {
    throw Object.assign(new Error("Unsupported expense category"), { code: "VALIDATION_FAILED", status: 400 });
  }
  const category = candidateCategory as ExpenseCategoryCode;

  const id = generateId();
  const now = new Date();
  const activeLocation = Array.from(memoryStore.locationReports.values())
    .filter((report) => report.organizationId === orgId && report.shiftId === shift.id && !report.departedAt)
    .sort((a, b) => b.arrivedAt.getTime() - a.arrivedAt.getTime())[0];
  const expense: StoredExpense = {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    operatorId: shift.operatorId,
    sellingLocationId: input.sellingLocationId ?? activeLocation?.sellingLocationId ?? shift.startLocationId,
    category,
    amountMinor: input.amount.amountMinor,
    currency: "IDR" as const,
    description: input.description?.trim() ?? "",
    note: input.operatorNote?.trim() || undefined,
    paidFrom: input.paidFrom,
    evidenceObjectKey: input.evidenceAssetId,
    reviewStatus: "SUBMITTED" as const,
    clientExpenseId: input.clientExpenseId,
    incurredAt: input.recordedAtDevice ?? now,
    createdAt: now,
  };
  memoryStore.expenses.set(id, expense);
  memoryStore.expenseByClientId.set(input.clientExpenseId, id);

  // Flagging check
  const record: ExpenseRecord = {
    expenseId: id,
    shiftId: input.shiftId,
    categoryCode: category,
    description: input.description ?? "",
    amount: input.amount,
    paidFrom: input.paidFrom,
    operatorNote: input.operatorNote,
    evidenceAssetId: input.evidenceAssetId,
    reviewState: "SUBMITTED",
    clientExpenseId: input.clientExpenseId,
  };
  let flaggedReason: string | undefined;
  if (matchesFlagPattern(record, "HIGH_AMOUNT")) flaggedReason = "HIGH_AMOUNT";
  else if (matchesFlagPattern(record, "NO_EVIDENCE_HIGH")) flaggedReason = "NO_EVIDENCE_HIGH";
  else if (matchesFlagPattern(record, "ROUND_AMOUNT")) flaggedReason = "ROUND_AMOUNT";

  if (flaggedReason) {
    expense.reviewStatus = "REVIEW_REQUIRED";
    expense.flaggedReason = flaggedReason;
    await writeAuditEvent({
      organizationId: orgId,
      actorKind: "SYSTEM",
      action: "expense.flagged",
      subjectKind: "expense",
      subjectId: id,
      correlationId: generateId(),
      occurredAt: now,
      afterSummary: { flaggedReason },
    });
  }

  await writeAuditEvent({
    organizationId: orgId,
    actorKind: input.actorKind ?? "OPERATOR",
    actorId: input.actorId ?? expense.operatorId,
    action: "expense.submitted",
    subjectKind: "expense",
    subjectId: id,
    correlationId: generateId(),
    occurredAt: now,
    afterSummary: { category, amount: input.amount.amountMinor, paidFrom: input.paidFrom },
  });

  return { expenseId: id };
}

export async function reviewExpense(input: {
  expenseId: string; decision: "REVIEWED" | "REJECTED" | "ESCALATED"; reason: string; reviewedBy: string; reviewerRole?: string; organizationId?: string; reviewerOperatorId?: string;
}): Promise<{ expenseId: string; newStatus: string }> {
  const expense = memoryStore.expenses.get(input.expenseId);
  if (!expense || (input.organizationId && expense.organizationId !== input.organizationId)) {
    throw Object.assign(new Error("Expense not found"), { code: "NOT_FOUND", status: 404 });
  }
  if (input.reviewedBy === expense.operatorId || input.reviewerOperatorId === expense.operatorId) {
    throw Object.assign(new Error("Submitter cannot review their own expense"), { code: "FORBIDDEN", status: 403 });
  }
  const current: ExpenseReviewState = expense.reviewStatus;
  let next: ExpenseReviewState;
  try {
    next = nextReviewState(current, input.decision, input.reason);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid review transition";
    throw Object.assign(new Error(message), { code: message.startsWith("Reason") ? "VALIDATION_FAILED" : "INVALID_TRANSITION", status: message.startsWith("Reason") ? 400 : 409 });
  }
  const prev = expense.reviewStatus;
  expense.reviewStatus = next;
  expense.reviewedBy = input.reviewedBy;
  expense.reviewedAt = new Date();
  expense.reviewReason = input.reason;
  memoryStore.expenses.set(expense.id, expense);

  const actionMap: Record<string, any> = {
    REVIEWED: "expense.reviewed",
    REJECTED: "expense.rejected",
    ESCALATED: "expense.escalated",
  };

  await writeAuditEvent({
    organizationId: expense.organizationId,
    actorKind: "HQ_USER",
    actorId: input.reviewedBy,
    actorRole: input.reviewerRole,
    action: actionMap[input.decision] || "expense.reviewed",
    subjectKind: "expense",
    subjectId: expense.id,
    reason: input.reason,
    correlationId: generateId(),
    occurredAt: new Date(),
    beforeSummary: { status: prev },
    afterSummary: { status: next },
  });

  return { expenseId: expense.id, newStatus: next };
}

export async function listExpensesForShift(shiftId: string): Promise<any[]> {
  const result = [];
  for (const exp of memoryStore.expenses.values()) {
    if (exp.shiftId === shiftId) result.push(exp);
  }
  return result;
}

export async function listExpensesForReview(orgId: string, status?: string): Promise<any[]> {
  const result = [];
  for (const exp of memoryStore.expenses.values()) {
    if (exp.organizationId !== orgId) continue;
    if (status && exp.reviewStatus !== status) continue;
    result.push(exp);
  }
  return result;
}
