/** TODO TESTS — Phase 0 (TESTING.md §4.7). Task: T-LOY-003. */
import { describe, it } from "vitest";

describe("reward redemption concurrency (T-LOY-003)", () => {
  it.todo("lets exactly one of two concurrent redemptions succeed (INV-06)");
  it.todo("returns a non-punitive ALREADY_REDEEMED outcome to the loser");
  it.todo("records the redemption in the loyalty ledger with the rules version");
});
