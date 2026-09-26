/** TODO TESTS — Phase 0 (TESTING.md §4.2, ADR-0012, ADR-0033). Tasks: T-PAY-002, T-PAY-003, T-PAY-004. */
import { describe, it } from "vitest";

describe("payment honesty (T-PAY-002/003/004)", () => {
  it.todo("records static QRIS as PENDING_VERIFICATION and never as PAID");
  it.todo("rejects a callback with an invalid signature and audits the rejection");
  it.todo("processes a duplicate callback idempotently");
  it.todo("routes an amount mismatch to human review instead of adjusting the sale");
  it.todo("requires a reason and evidence note on every manual reconciliation");
  it.todo("keeps verified and unverified digital amounts separate in every output (FR-PAYMENT-010)");
});
