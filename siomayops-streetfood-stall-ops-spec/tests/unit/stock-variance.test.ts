/** TODO TESTS — Phase 0 (TESTING.md §4.5, ADR-0030). Task: T-STOCK-002. */
import { describe, it } from "vitest";

describe("stock variance (T-STOCK-002, ADR-0030)", () => {
  it.todo("derives position from movements and never from a stored balance (INV-12)");
  it.todo("accepts UNKNOWN as a valid variance reason");
  it.todo("marks an item not counted as UNCOUNTED instead of zero (FR-STOCK-012)");
  it.todo("never changes operator status, pay or assignment as a result of a variance");
});
