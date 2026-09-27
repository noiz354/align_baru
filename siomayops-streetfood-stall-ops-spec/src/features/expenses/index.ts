import { memoryStore, generateId } from "../../server/db/memory-store";
import type { Money } from "../../shared/money";
import { writeAuditEvent } from "../audit";
import { nextReviewState, matchesFlagPattern, type ExpenseRecord } from "../../domain/expense/review";
import { money } from "../../shared/money/money";

const DEFAULT_ORG = process.env.FAKE_ORG_ID || "00000000-0000-7000-0000-000000000001";

export interface SubmitExpenseInput {
  shiftId: string;
  categoryId?: string;
  categoryCode?: string;
  description: string;
  amount: Money;
  paidFrom: "CASH_BOX" | "PERSONAL";
  operatorNote?: string;
  evidenceAssetId?: string;
  clientExpenseId: string;
  recordedAtDevice?: Date;
  sellingLocationId?: string;
  operatorId?: string;
  organizationId?: string;
}

export async function submitExpense(input: SubmitExpenseInput): Promise<{ expenseId: string }> {
  const orgId = input.organizationId || DEFAULT_ORG;
  // Idempotency
  const existingId = memoryStore.expenseByClientId.get(input.clientExpenseId);
  if (existingId) {
    return { expenseId: existingId };
  }
  const shift = memoryStore.shifts.get(input.shiftId);
  if (!shift) throw Object.assign(new Error("Shift not found"), { code: "NOT_FOUND" });

  const category = input.categoryCode || "OTHER_OPERATIONAL";
  // Validate neutral categories
  const allowedCategories = ["UNVERIFIED_FIELD_EXPENSE", "TRANSPORT", "CLEANING", "CONSUMABLE", "REPAIR_MINOR", "PARKING", "OTHER_OPERATIONAL"];
  if (!allowedCategories.includes(category)) {
    throw Object.assign(new Error(`Invalid category ${category}`), { code: "VALIDATION_FAILED" });
  }

  const id = generateId();
  const now = new Date();
  const expense: any = {
    id,
    organizationId: orgId,
    shiftId: input.shiftId,
    operatorId: input.operatorId || shift.operatorId,
    sellingLocationId: input.sellingLocationId,
    category,
    amountMinor: input.amount.amountMinor,
    currency: "IDR" as const,
    description: input.description,
    note: input.operatorNote,
    paidFrom: input.paidFrom,
    evidenceObjectKey: input.evidenceAssetId,
    reviewStatus: "SUBMITTED",
    clientExpenseId: input.clientExpenseId,
    incurredAt: input.recordedAtDevice || now,
    createdAt: now,
  };
  memoryStore.expenses.set(id, expense);
  memoryStore.expenseByClientId.set(input.clientExpenseId, id);

  // Flagging check
  const record: ExpenseRecord = {
    expenseId: id,
    shiftId: input.shiftId,
    categoryCode: category as any,
    description: input.description,
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
    (expense as any).flaggedReason = flaggedReason;
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
    actorKind: "OPERATOR",
    actorId: expense.operatorId,
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
  expenseId: string; decision: "REVIEWED" | "REJECTED" | "ESCALATED"; reason: string; reviewedBy: string; organizationId?: string;
}): Promise<{ expenseId: string; newStatus: string }> {
  const expense = memoryStore.expenses.get(input.expenseId);
  if (!expense) throw Object.assign(new Error("Expense not found"), { code: "NOT_FOUND" });
  const current = expense.reviewStatus as any;
  const next = nextReviewState(current, input.decision, input.reason);
  const prev = expense.reviewStatus;
  expense.reviewStatus = next as any;
  expense.reviewedBy = input.reviewedBy;
  expense.reviewedAt = new Date();
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
