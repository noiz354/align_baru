export const EXPENSE_CATEGORY_CODES = [
  "UNVERIFIED_FIELD_EXPENSE", "TRANSPORT", "CLEANING", "CONSUMABLE",
  "REPAIR_MINOR", "PARKING", "OTHER_OPERATIONAL",
] as const;

export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORY_CODES)[number];
export type ExpenseReviewState = "SUBMITTED" | "REVIEW_REQUIRED" | "REVIEWED" | "REJECTED" | "ESCALATED";
export type ExpensePaidFrom = "CASH_BOX" | "PERSONAL";

export interface ExpenseRecord {
  readonly expenseId: string;
  readonly shiftId: string;
  readonly categoryCode: ExpenseCategoryCode;
  readonly description?: string;
  readonly amount: import("../../shared/money").Money;
  readonly paidFrom: ExpensePaidFrom;
  readonly operatorNote?: string;
  readonly evidenceAssetId?: string;
  readonly reviewState: ExpenseReviewState;
  readonly clientExpenseId: string;
}

const REVIEW_TRANSITIONS: Record<ExpenseReviewState, ExpenseReviewState[]> = {
  SUBMITTED: ["REVIEW_REQUIRED", "REVIEWED", "REJECTED", "ESCALATED"],
  REVIEW_REQUIRED: ["REVIEWED", "REJECTED", "ESCALATED"],
  REVIEWED: [],
  REJECTED: ["REVIEW_REQUIRED"],
  ESCALATED: ["REVIEWED", "REJECTED"],
};

export function nextReviewState(
  current: ExpenseReviewState,
  decision: "REVIEWED" | "REJECTED" | "ESCALATED",
  reason: string
): ExpenseReviewState {
  if (!reason || reason.trim().length < 3) throw new Error("Reason required, min 3 chars");
  const allowed = REVIEW_TRANSITIONS[current];
  if (!allowed.includes(decision as ExpenseReviewState)) {
    throw new Error(`Invalid expense review transition ${current} -> ${decision}`);
  }
  return decision as ExpenseReviewState;
}

export function matchesFlagPattern(
  record: ExpenseRecord,
  patternId: string
): boolean {
  // Pattern matching against RECORDS, never personalities (per ADR)
  // Implement simple patterns:
  switch (patternId) {
    case "HIGH_AMOUNT":
      return record.amount.amountMinor > 200000; // >200k IDR
    case "REPEATED_UNVERIFIED":
      return record.categoryCode === "UNVERIFIED_FIELD_EXPENSE";
    case "ROUND_AMOUNT":
      return record.amount.amountMinor % 50000 === 0 && record.amount.amountMinor >= 50000;
    case "NO_EVIDENCE_HIGH":
      return !record.evidenceAssetId && record.amount.amountMinor > 100000;
    case "FREQUENT_SAME_SHIFT":
      // This would need shift context, return false for single record check
      return false;
    default:
      return false;
  }
}
