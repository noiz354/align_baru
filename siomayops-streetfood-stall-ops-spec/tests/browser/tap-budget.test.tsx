/**
 * TODO TESTS — Phase 0 (TESTING.md §4.9, DESIGN.md §4). Task: T-FOUND-002.
 * Browser Mode (Vitest 4 + Playwright provider) is required here because tap-target size,
 * contrast and real events cannot be verified in jsdom.
 */
import { describe, it } from "vitest";

describe("operator tap budgets and accessibility (T-FOUND-002)", () => {
  it.todo("completes a 1-item cash sale in 4 taps or fewer on a 360x640 viewport");
  it.todo("completes a 3-item cash sale with change in 6 taps or fewer");
  it.todo("records a field expense in 4 taps or fewer");
  it.todo("starts a shift in 4 taps or fewer");
  it.todo("closes the day in 8 taps or fewer");
  it.todo("keeps every control at 44x44 px minimum (72x72 px for POS tiles)");
  it.todo("keeps text contrast at 4.5:1 or better in the operator palette");
  it.todo("never conveys payment status by colour alone (NFR-ACCESS-003)");
});
