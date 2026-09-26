/** TODO TESTS — Phase 0 (ADR-0026). Task: T-FOUND-003. */
import { describe, it } from "vitest";

describe("append-only audit (T-FOUND-003)", () => {
  it.todo("writes the audit row in the same transaction as the business change (INV-09)");
  it.todo("fails the whole operation when the audit row cannot be written");
  it.todo("rejects UPDATE and DELETE on audit rows at the database level");
  it.todo("requires a reason for corrections, voids, overrides and reconciliations (FR-AUDIT-002)");
  it.todo("reconstructs a shift end-to-end from audit and domain records (FR-AUDIT-008)");
});
