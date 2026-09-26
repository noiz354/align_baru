/**
 * TODO TESTS — Phase 0 (TESTING.md §4.4, EXPENSES.md, ADR-0027).
 * These tests also encode the ethics boundary: the model contains no recipient, no claimed
 * authority and no asserted purpose, and nothing in the review path can automate a consequence.
 */
import { describe, it } from "vitest";

describe("expense review (T-EXP-002, ADR-0027)", () => {
  it.todo("records UNVERIFIED_FIELD_EXPENSE with description, amount, time, location and note only");
  it.todo("has no field for recipient identity or claimed authority anywhere in the model");
  it.todo("requires a reason for REJECTED and ESCALATED and keeps the record visible afterwards");
  it.todo("never deletes or hides an expense, including rejected ones");
  it.todo("keeps pattern flags attached to records and never to a person");
  it.todo("never triggers an automatic consequence from a flag (FR-EXPENSE-007)");
});
