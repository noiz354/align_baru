/** TODO TESTS — Phase 0 (TESTING.md §4.2, STATE_MACHINE.md). Task: T-PAY-001. */
import { describe, it } from "vitest";

describe("payment state machine (T-PAY-001, ADR-0033)", () => {
  it.todo("has no transition that reaches PAID from the client or an offline replay (INV-13)");
  it.todo("allows PAID only with verified provider evidence or a reconciliation record (INV-02)");
  it.todo("refuses REFUNDED without an explicit refund record");
  it.todo("keeps PENDING_VERIFICATION separate from PAID in every projection");
  it.todo("rejects an out-of-order callback after EXPIRED without a reconciliation path");
});
