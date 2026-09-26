/** TODO TESTS — Phase 0 (PRICING.md §override, ADR-0009). Task: T-PRICE-004. */
import { describe, it } from "vitest";

describe("operator price override policy (T-PRICE-004)", () => {
  it.todo("HQ_ONLY refuses every field override and explains why");
  it.todo("SUPERVISOR_APPROVED applies only after a server-verified approval");
  it.todo("OPERATOR_ALLOWED respects amount and percentage bounds and the daily count cap");
  it.todo("expires an override at shift end or after 24 hours, whichever is sooner");
  it.todo("records base price, override price, reason code, authoriser and expiry on every override");
});
