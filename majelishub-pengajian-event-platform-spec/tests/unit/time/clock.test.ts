/**
 * TEST SKELETON - time/clock.test.ts
 * Layer: unit · Owning task: T-ARCH-001 · Requirement(s): FR-EVENT-010
 * Specification: ADR-0018
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: timezone mistakes make a mosque announce the wrong time.
 */
import { describe, test } from "vitest";

describe.todo("clock and timezone", () => {
  test.todo("returns the venue-local weekday and offset for Asia/Jakarta, Asia/Makassar and Asia/Jayapura");
  test.todo("never derives a local time from a fixed offset");
  test.todo("keeps all stored instants in UTC");});
