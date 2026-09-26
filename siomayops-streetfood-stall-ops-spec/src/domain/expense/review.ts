/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Expenses (EXPENSES.md, ADR-0027). Field payments are recorded NEUTRALLY as
 * UNVERIFIED_FIELD_EXPENSE (or another auditable category). The domain knows nothing about who
 * received a payment or why, and contains no workflow that would facilitate, hide or optimise it.
 */
export type ExpenseCategoryCode =
  | "UNVERIFIED_FIELD_EXPENSE" | "TRANSPORT" | "CLEANING" | "CONSUMABLE"
  | "REPAIR_MINOR" | "PARKING" | "OTHER_OPERATIONAL";

export type ExpenseReviewState = "SUBMITTED" | "REVIEW_REQUIRED" | "REVIEWED" | "REJECTED" | "ESCALATED";

export type ExpensePaidFrom = "CASH_BOX" | "PERSONAL";

export interface ExpenseRecord {
  readonly expenseId: string;
  readonly shiftId: string;
  readonly categoryCode: ExpenseCategoryCode;
  readonly description: string;
  readonly amount: import("../../shared/money").Money;
  readonly paidFrom: ExpensePaidFrom;
  readonly operatorNote?: string;
  readonly evidenceAssetId?: string;
  readonly reviewState: ExpenseReviewState;
  readonly clientExpenseId: string;
}

/** Throws. Task: T-EXP-002. */
export function nextReviewState(
  _current: ExpenseReviewState,
  _decision: "REVIEWED" | "REJECTED" | "ESCALATED",
  _reason: string
): ExpenseReviewState {
  throw new Error("Not implemented: T-EXP-002");
}

/** Throws. Task: T-EXP-003. Patterns are matched against RECORDS, never personalities. */
export function matchesFlagPattern(
  _record: ExpenseRecord,
  _patternId: string
): boolean {
  throw new Error("Not implemented: T-EXP-003");
}
