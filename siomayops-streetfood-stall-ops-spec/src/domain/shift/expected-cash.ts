import { addMoney, subtractMoney, sumMoney, money, type Money } from "../../shared/money";

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

export function prepareShiftClosing(input: ExpectedCashInput): ExpectedCashBreakdown {
  // expected = opening + cash sales - cash expenses - removals + handovers
  let expected = input.openingCash;
  expected = addMoney(expected, input.cashSalesTotal);
  expected = subtractMoney(expected, input.cashExpensesTotal);
  if (input.cashRemovalsTotal) {
    expected = subtractMoney(expected, input.cashRemovalsTotal);
  }
  if (input.handoverAdjustments && input.handoverAdjustments.length > 0) {
    const handoverSum = sumMoney(input.handoverAdjustments);
    expected = addMoney(expected, handoverSum);
  }
  const components = [
    { labelMessageId: "closing.opening_cash", amount: input.openingCash },
    { labelMessageId: "closing.cash_sales", amount: input.cashSalesTotal },
    { labelMessageId: "closing.cash_expenses", amount: money(-input.cashExpensesTotal.amountMinor, input.cashExpensesTotal.currency) },
  ] as const;

  return {
    expected,
    components: [...components],
  };
}

export function computeCashVariance(expected: Money, counted: Money): Money {
  // neutral difference: counted - expected
  return subtractMoney(counted, expected);
}
