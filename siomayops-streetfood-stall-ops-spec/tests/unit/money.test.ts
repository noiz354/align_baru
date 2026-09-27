import { describe, it, expect } from "vitest";
import { money, addMoney, subtractMoney, applyPercentage, allocate, fromProviderDecimalString, sumMoney, formatMoneyForOperator } from "@/shared/money/money";
import { computeSaleTotalFromSnapshots } from "@/domain/sale/totals";

describe("money primitives (T-FOUND-006, ADR-0006)", () => {
  it("rejects a floating-point value anywhere in a money path (INV-01)", () => {
    expect(() => money(10.5 as any)).toThrow();
    expect(() => money(NaN as any)).toThrow();
  });

  it("adds and subtracts integer minor units exactly, with currency preserved", () => {
    const a = money(10000, "IDR");
    const b = money(5000, "IDR");
    expect(addMoney(a, b).amountMinor).toBe(15000);
    expect(subtractMoney(a, b).amountMinor).toBe(5000);
    expect(addMoney(a, b).currency).toBe("IDR");
  });

  it("applies a percentage discount with a single half-up rounding step", () => {
    const base = money(10000, "IDR");
    const discount = applyPercentage(base, 10);
    expect(discount.amountMinor).toBe(1000);
    const base2 = money(999, "IDR");
    const d2 = applyPercentage(base2, 10);
    expect(d2.amountMinor).toBe(100); // 99.9 -> 100 half-up
  });

  it("allocates a total across weights without losing or creating a rupiah", () => {
    const total = money(100, "IDR");
    const parts = allocate(total, [1, 1, 1]);
    const sum = sumMoney(parts);
    expect(sum.amountMinor).toBe(100);
    expect(parts.length).toBe(3);
  });

  it("converts a provider decimal string (e.g. '10000.00') only at the adapter boundary", () => {
    const m = fromProviderDecimalString("10000.00", "IDR");
    expect(m.amountMinor).toBe(10000);
    const m2 = fromProviderDecimalString("12500", "IDR");
    expect(m2.amountMinor).toBe(12500);
    expect(() => fromProviderDecimalString("invalid")).toThrow();
  });

  it("recomputes a historical sale total from its snapshots to exactly the stored total (INV-05)", () => {
    const lines = [
      { menuItemId: "a", quantity: 2, unitPriceSnapshot: money(15000, "IDR") },
      { menuItemId: "b", quantity: 1, unitPriceSnapshot: money(12000, "IDR") },
    ];
    const totals = computeSaleTotalFromSnapshots(lines);
    expect(totals.payableTotal.amountMinor).toBe(42000);
    expect(totals.linesTotal.amountMinor).toBe(42000);
    // Simulate stored total
    const storedTotal = money(42000, "IDR");
    expect(totals.payableTotal.amountMinor).toBe(storedTotal.amountMinor);
  });

  it("formats money for operator in Indonesian locale", () => {
    const m = money(12500, "IDR");
    const formatted = formatMoneyForOperator(m);
    expect(formatted).toContain("12");
  });
});
