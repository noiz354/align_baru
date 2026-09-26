/** TODO TESTS — Phase 0 (TESTING.md §4.7, LOYALTY.md). Task: T-LOY-003. */
import { describe, it } from "vitest";

describe("loyalty redemption (T-LOY-003, ADR-0028)", () => {
  it.todo("refuses redemption without recorded consent");
  it.todo("allows a reward instance to be redeemed at most once, even concurrently (INV-06)");
  it.todo("refuses redemption by the operator's own account (no self-award)");
  it.todo("refuses an online-required reward while offline");
  it.todo("keeps a 'already redeemed' outcome non-punitive in wording");
});
