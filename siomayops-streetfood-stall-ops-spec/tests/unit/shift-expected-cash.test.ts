/** TODO TESTS — Phase 0 (TESTING.md §4.6, SETTLEMENT.md). Task: T-CLOSE-001. */
import { describe, it } from "vitest";

describe("expected cash (T-CLOSE-001)", () => {
  it.todo("computes expected = opening + cash sales − cash expenses");
  it.todo("excludes every digital amount (verified and unverified) from the arithmetic");
  it.todo("computes a neutral variance figure and never calls it 'hilang'");
  it.todo("requires a reason when the variance exceeds the configured tolerance");
  it.todo("never adjusts expected cash to match the counted amount (FR-CASH-006)");
});
