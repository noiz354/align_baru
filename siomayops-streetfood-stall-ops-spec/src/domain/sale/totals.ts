import { money, addMoney, subtractMoney, type Money, type CurrencyCode } from "../../shared/money";

export type SaleStatus = "DRAFT" | "COMPLETED" | "VOIDED" | "CORRECTED";

export interface SaleLineSnapshot {
  readonly menuItemId: string;
  readonly quantity: number;
  readonly unitPriceSnapshot: Money;
  readonly pricePolicyId?: string;
  readonly overrideId?: string;
}

export interface SaleTotals {
  readonly linesTotal: Money;
  readonly discountTotal: Money;
  readonly payableTotal: Money;
  readonly currency: CurrencyCode;
}

export function computeSaleTotalFromSnapshots(
  lines: readonly SaleLineSnapshot[],
  discount?: Money
): SaleTotals {
  if (lines.length === 0) throw new Error("Sale must have at least one line");
  const currency = lines[0]!.unitPriceSnapshot.currency;
  let linesTotalMinor = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Invalid quantity ${line.quantity}`);
    }
    if (line.unitPriceSnapshot.currency !== currency) {
      throw new Error("Currency mismatch in sale lines");
    }
    if (!Number.isInteger(line.unitPriceSnapshot.amountMinor)) {
      throw new Error("Money must be integer minor units");
    }
    linesTotalMinor += line.unitPriceSnapshot.amountMinor * line.quantity;
  }
  const linesTotal = money(linesTotalMinor, currency);
  const discountTotal = discount ?? money(0, currency);
  if (discountTotal.currency !== currency) throw new Error("Discount currency mismatch");
  if (discountTotal.amountMinor < 0) throw new Error("Discount cannot be negative");
  if (discountTotal.amountMinor > linesTotalMinor) throw new Error("Discount exceeds total");
  const payableTotal = subtractMoney(linesTotal, discountTotal);
  return { linesTotal, discountTotal, payableTotal, currency };
}

export function computeChangeForCash(payable: Money, cashReceived: Money): Money {
  if (payable.currency !== cashReceived.currency) throw new Error("Currency mismatch");
  if (cashReceived.amountMinor < payable.amountMinor) {
    throw new Error("Insufficient cash received");
  }
  return money(cashReceived.amountMinor - payable.amountMinor, payable.currency);
}
