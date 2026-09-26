/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * Expected cash is a DERIVED, explainable figure (SETTLEMENT.md §2, TASKS.md T-CLOSE-001):
 *   expected = opening cash + cash sales − cash expenses (and explicit cash removals/handovers).
 * Digital amounts NEVER enter this arithmetic — verified and unverified digital money is not cash.
 * Fast-path per the brief: `prepareShiftClosing` is the mandated example stub (alias T-SHIFT-031).
 */
import type { Money } from "../../shared/money";

export interface ExpectedCashInput {
  readonly openingCash: Money;
  readonly cashSalesTotal: Money;
  readonly cashExpensesTotal: Money;
  readonly cashRemovalsTotal?: Money;
  readonly handoverAdjustments?: readonly Money[];
}

export interface ExpectedCashBreakdown {
  readonly expected: Money;
  readonly components: readonly { readonly labelMessageId: string; readonly amount: Money }[];
}

/** Mandated Phase-0 example: throws `Not implemented: T-SHIFT-031` (alias of T-CLOSE-001). */
export function prepareShiftClosing(_input: ExpectedCashInput): ExpectedCashBreakdown {
  throw new Error("Not implemented: T-SHIFT-031");
}

/** Throws. Task: T-CLOSE-001. Difference is neutral: "selisih", never "hilang". */
export function computeCashVariance(_expected: Money, _counted: Money): Money {
  throw new Error("Not implemented: T-CLOSE-001");
}
