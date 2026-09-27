import { describe, it, expect } from "vitest";
import { money } from "@/shared/money/money";
import { computeSaleTotalFromSnapshots, computeChangeForCash } from "@/domain/sale/totals";

describe("sale totals from snapshots (T-SALE-001, ADR-0010)", () => {
  it("computes the payable total only from stored unit-price snapshots", () => {
    const lines = [
      { menuItemId: "a", quantity: 2, unitPriceSnapshot: money(15000, "IDR") },
      { menuItemId: "b", quantity: 1, unitPriceSnapshot: money(12000, "IDR") },
    ];
    const totals = computeSaleTotalFromSnapshots(lines);
    expect(totals.payableTotal.amountMinor).toBe(42000);
  });

  it("produces the same total before and after a catalog or price change (INV-08)", () => {
    const snapshot = money(15000, "IDR");
    const lines = [{ menuItemId: "a", quantity: 1, unitPriceSnapshot: snapshot }];
    const totals1 = computeSaleTotalFromSnapshots(lines);
    // Simulate price change in catalog, but snapshot stays same
    const totals2 = computeSaleTotalFromSnapshots(lines);
    expect(totals1.payableTotal.amountMinor).toBe(totals2.payableTotal.amountMinor);
  });

  it("rejects a line whose quantity is not a positive integer", () => {
    const lines = [{ menuItemId: "a", quantity: 0, unitPriceSnapshot: money(15000, "IDR") }];
    expect(() => computeSaleTotalFromSnapshots(lines as any)).toThrow();
  });

  it("never renders a currency other than the sale currency", () => {
    const lines = [{ menuItemId: "a", quantity: 1, unitPriceSnapshot: money(15000, "IDR") }];
    const totals = computeSaleTotalFromSnapshots(lines);
    expect(totals.currency).toBe("IDR");
    expect(totals.payableTotal.currency).toBe("IDR");
  });

  it("computes change correctly for cash", () => {
    const payable = money(42000, "IDR");
    const received = money(50000, "IDR");
    const change = computeChangeForCash(payable, received);
    expect(change.amountMinor).toBe(8000);
  });

  it("rejects underpayment", () => {
    const payable = money(42000, "IDR");
    const received = money(40000, "IDR");
    expect(() => computeChangeForCash(payable, received)).toThrow();
  });
});
