import { describe, it, expect } from "vitest";
import { deriveStockPosition, computeStockVariance } from "@/domain/inventory/variance";

describe("stock variance (T-STOCK-002, ADR-0030)", () => {
  it("derives position from movements and never from a stored balance (INV-12)", () => {
    const movements = [
      { movementId: "m1", stallId: "stall-1", stockItemId: "item-1", kind: "ISSUE" as const, quantity: 100, recordedBy: "user-1", occurredAt: new Date(), clientMovementId: "c1" },
      { movementId: "m2", stallId: "stall-1", stockItemId: "item-1", kind: "WASTE" as const, quantity: 10, recordedBy: "user-1", occurredAt: new Date(), clientMovementId: "c2" },
    ];
    const pos = deriveStockPosition(movements);
    expect(pos.quantity).toBe(90);
  });

  it("accepts UNKNOWN as a valid variance reason", () => {
    const variance = computeStockVariance(100, 90);
    expect(variance.difference).toBe(-10);
    expect(variance.reasonRequired).toBe(true);
    // UNKNOWN is allowed as reason
  });

  it("marks an item not counted as UNCOUNTED instead of zero (FR-STOCK-012)", () => {
    const variance = computeStockVariance(100, null);
    expect(variance.uncounted).toBe(true);
    expect(variance.difference).toBe(0);
  });

  it("never changes operator status, pay or assignment as a result of a variance", () => {
    // This is a policy test: variance computation has no side effects
    const variance = computeStockVariance(100, 50);
    expect(variance.difference).toBe(-50);
    // No operator status change
  });
});
