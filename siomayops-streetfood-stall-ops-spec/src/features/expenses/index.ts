/**
 * PHASE 0 — USE-CASE PORT + STUBS. No logic (ADR-0036).
 *
 * EXPENSE POLICY (ADR-0027, PRD §9.2 — binding):
 *  - field payments are recorded NEUTRALLY (UNVERIFIED_FIELD_EXPENSE or another auditable category);
 *  - recipient identity, claimed authority and asserted purpose are NOT requested and NOT stored;
 *  - nothing here approves, hides, accelerates or optimises irregular payments;
 *  - review is a human decision with a reason; flags concern records, never personalities.
 */
import type { ExpenseId, ShiftId } from "../../shared/types/ids";
import type { Money } from "../../shared/money";
import type { ExpenseCategoryCode, ExpenseReviewState, ExpensePaidFrom } from "../../domain/expense";

export type { ExpenseCategoryCode, ExpenseReviewState, ExpensePaidFrom };

export interface ExpenseRecordView {
  readonly expenseId: ExpenseId;
  readonly shiftId: ShiftId;
  readonly categoryCode: ExpenseCategoryCode;
  readonly description: string;
  readonly amount: Money;
  readonly paidFrom: ExpensePaidFrom;
  readonly reviewState: ExpenseReviewState;
}

/** Requirements: FR-EXPENSE-001/002/003/012. Task: T-EXP-001. ≤4 taps, offline-OK. */
export async function submitExpense(_input: {
  shiftId: ShiftId; categoryCode: ExpenseCategoryCode; description: string; amount: Money;
  paidFrom: ExpensePaidFrom; operatorNote?: string; evidenceAssetId?: string; clientExpenseId: string;
}): Promise<ExpenseRecordView> {
  throw new Error("Not implemented: T-EXP-001");
}

/** Requirements: FR-EXPENSE-005/007. Task: T-EXP-002. Human decision; reason mandatory; audited. */
export async function reviewExpense(_input: {
  expenseId: ExpenseId; decision: "REVIEWED" | "REJECTED" | "ESCALATED"; reason: string;
}): Promise<ExpenseRecordView> {
  throw new Error("Not implemented: T-EXP-002");
}

/** Requirements: FR-EXPENSE-006. Task: T-EXP-003. Pattern hits are about records, not people. */
export async function evaluateExpenseFlags(_input: {
  organizationId: string; periodBusinessDay: string;
}): Promise<readonly { readonly expenseId: ExpenseId; readonly patternId: string }[]> {
  throw new Error("Not implemented: T-EXP-003");
}

/** Requirements: FR-EXPENSE-008. Task: T-EXP-002. Certification is a statement, not a score. */
export async function certifyExpenses(_input: {
  operatorId: string; periodBusinessDay: string; statementNote?: string;
}): Promise<{ readonly certificationId: string }> {
  throw new Error("Not implemented: T-EXP-002");
}
