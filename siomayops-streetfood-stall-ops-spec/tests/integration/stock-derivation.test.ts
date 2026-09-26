/** TODO TESTS — Phase 0 (TESTING.md §4.5). Tasks: T-STOCK-001, T-STOCK-002. */
import { describe, it } from "vitest";

describe("stock derivation (T-STOCK-001/002)", () => {
  it.todo("derives the same position regardless of movement insertion order (INV-12)");
  it.todo("treats a duplicate movement client id as idempotent");
  it.todo("shows a negative derived position as a variance needing a reason, never auto-corrected");
  it.todo("requires the receiving operator's confirmation for a transfer");
});
