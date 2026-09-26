/**
 * PHASE 0 — SKELETON ONLY. No business logic, no I/O, no calculations.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX`.
 * See ADR-0036 (skeleton policy) and AGENTS.md.
 */

/** ISO-4217 code. IDR is the pilot currency; the type stays currency-aware on purpose. */
export type CurrencyCode = "IDR";

/**
 * Money as an integer amount in MINOR UNITS (ADR-0006).
 * For IDR the minor unit is 1 rupiah (no circulating sen), so amountMinor is whole rupiah.
 * Branded so a plain `number` can never be passed where money is expected (INV-01).
 */
export type Money = Readonly<{
  readonly __brand: "Money";
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}>;

/** Construction only — no arithmetic. Safe to use in Phase 0 type positions and fixtures. */
export function money(amountMinor: number, currency: CurrencyCode = "IDR"): Money {
  return { __brand: "Money", amountMinor, currency };
}

/** Throws. Task: T-FOUND-006 (Money and time primitives). */
export function addMoney(_a: Money, _b: Money): Money {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. */
export function subtractMoney(_a: Money, _b: Money): Money {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. Percentage maths with a single documented rounding step. */
export function applyPercentage(_base: Money, _percent: number): Money {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. Allocation must preserve the total exactly. */
export function allocate(_total: Money, _weights: readonly number[]): readonly Money[] {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. Boundary conversion from provider decimal strings, e.g. "10000.00". */
export function fromProviderDecimalString(_value: string, _currency: CurrencyCode = "IDR"): Money {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Throws. Task: T-FOUND-006. Sum of sale-line snapshots; must equal the stored sale total (INV-05). */
export function sumMoney(_values: readonly Money[]): Money {
  throw new Error("Not implemented: T-FOUND-006");
}

/** Formatting for display only; Indonesian grouping, no decimals for IDR. Throws. Task: T-FOUND-002. */
export function formatMoneyForOperator(_value: Money): string {
  throw new Error("Not implemented: T-FOUND-002");
}
