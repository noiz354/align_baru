/** TODO TESTS — Phase 0 (TESTING.md §4.2, SALES.md). Task: T-SALE-001. */
import { describe, it } from "vitest";

describe("sale totals from snapshots (T-SALE-001, ADR-0010)", () => {
  it.todo("computes the payable total only from stored unit-price snapshots");
  it.todo("produces the same total before and after a catalog or price change (INV-08)");
  it.todo("rejects a line whose quantity is not a positive integer");
  it.todo("never renders a currency other than the sale currency");
});
