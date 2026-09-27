/** Money as integer minor units (ADR-0006). Implementation: T-FOUND-006 */

export type CurrencyCode = "IDR";

export type Money = Readonly<{
  readonly __brand: "Money";
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}>;

function assertInteger(n: number): void {
  if (!Number.isInteger(n)) {
    throw new Error(`Money amount must be integer minor units, got ${n}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Money amount out of safe integer range: ${n}`);
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function money(amountMinor: number, currency: CurrencyCode = "IDR"): Money {
  assertInteger(amountMinor);
  return { __brand: "Money", amountMinor, currency } as Money;
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function sumMoney(values: readonly Money[]): Money {
  if (values.length === 0) {
    return money(0, "IDR");
  }
  const currency = values[0]!.currency;
  let total = 0;
  for (const v of values) {
    if (v.currency !== currency) throw new Error(`Currency mismatch in sum`);
    assertInteger(v.amountMinor);
    total += v.amountMinor;
  }
  return money(total, currency);
}

export function applyPercentage(base: Money, percent: number): Money {
  if (!Number.isFinite(percent)) throw new Error("Invalid percent");
  // single half-up rounding step
  const result = Math.round(base.amountMinor * (percent / 100));
  assertInteger(result);
  return money(result, base.currency);
}

export function allocate(total: Money, weights: readonly number[]): readonly Money[] {
  if (weights.length === 0) return [];
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) throw new Error("Total weight must be positive");
  let remainder = total.amountMinor;
  const result: number[] = [];
  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      result.push(remainder);
    } else {
      const share = Math.floor(total.amountMinor * (weights[i]! / totalWeight));
      result.push(share);
      remainder -= share;
    }
  }
  // Distribute remainder one by one to preserve total exactly (largest remainder method simple)
  // Since we used floor, remainder >=0. Distribute.
  let idx = 0;
  while (remainder > result.reduce((a, b) => a + b, 0) ? 0 : 0) {
    // This loop not needed because last gets remainder, but keep for correctness if negative?
    break;
  }
  // Actually ensure sum equals total: our method already gives last = remainder, so sum = total.
  // But to handle rounding better, distribute leftover from floor.
  // Recompute with proper largest remainder:
  const raw = weights.map(w => total.amountMinor * (w / totalWeight));
  const floored = raw.map(r => Math.floor(r));
  let allocated = floored.reduce((a, b) => a + b, 0);
  let diff = total.amountMinor - allocated;
  // Distribute diff by largest fractional part
  const fractions = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < diff; k++) {
    const target = fractions[k % fractions.length]!.i;
    floored[target]! += 1;
  }
  // If diff negative (should not happen with floor), handle
  if (diff < 0) {
    // Remove from smallest fractions
    const asc = [...fractions].reverse();
    for (let k = 0; k < Math.abs(diff); k++) {
      const target = asc[k % asc.length]!.i;
      floored[target]! -= 1;
    }
  }
  return floored.map(v => money(v, total.currency));
}

export function fromProviderDecimalString(value: string, currency: CurrencyCode = "IDR"): Money {
  // Provider decimal strings like "10000.00" or "12500" -> minor units
  // For IDR, minor = rupiah, so we parse and round to nearest integer.
  // This is the ONLY place where decimal string conversion happens (ADR-0006).
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid provider decimal string: ${value}`);
  }
  // For IDR, no sen, but handle decimals by rounding half-up.
  const num = Number(trimmed);
  if (!Number.isFinite(num)) throw new Error(`Invalid provider decimal: ${value}`);
  // Convert: if string has decimals, multiply? For IDR, decimal part is fraction of rupiah (should be .00)
  // We round to nearest integer minor.
  const minor = Math.round(num);
  assertInteger(minor);
  return money(minor, currency);
}

export function formatMoneyForOperator(value: Money): string {
  // Indonesian grouping, no decimals for IDR, with Rp prefix
  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(value.amountMinor);
}

export function isMoneyEqual(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amountMinor - b.amountMinor;
}

export function isNegative(m: Money): boolean {
  return m.amountMinor < 0;
}
