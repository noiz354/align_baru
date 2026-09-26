/**
 * TODO TESTS — Phase 0 (TESTING.md §4.1). No implementation exists; these are the scenarios that
 * must pass once T-FOUND-006 lands. Suites are intentionally `it.todo` so CI stays green.
 */
import { describe, it } from "vitest";

describe("money primitives (T-FOUND-006, ADR-0006)", () => {
  it.todo("rejects a floating-point value anywhere in a money path (INV-01)");
  it.todo("adds and subtracts integer minor units exactly, with currency preserved");
  it.todo("applies a percentage discount with a single half-up rounding step");
  it.todo("allocates a total across weights without losing or creating a rupiah");
  it.todo("converts a provider decimal string (e.g. '10000.00') only at the adapter boundary");
  it.todo("recomputes a historical sale total from its snapshots to exactly the stored total (INV-05)");
});
