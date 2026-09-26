/** TODO TESTS — Phase 0 (TESTING.md §4.1, PRICING.md). Task: T-PRICE-002. */
import { describe, it } from "vitest";

describe("deterministic price resolution (T-PRICE-002, ADR-0008)", () => {
  it.todo("prefers LOCATION over AREA over ORG");
  it.todo("breaks ties by the newest effectiveFrom");
  it.todo("fails loudly with PRICE_RESOLUTION_AMBIGUOUS on an exact tie");
  it.todo("returns NOT_SELLABLE rather than zero when no policy exists");
  it.todo("ignores expired policies without silently falling back to another scope");
  it.todo("preserves the resolved policy id as provenance for the sale line");
});
