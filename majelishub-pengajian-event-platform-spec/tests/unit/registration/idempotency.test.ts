/**
 * TEST SKELETON - registration/idempotency.test.ts
 * Layer: unit · Owning task: T-REG-009 · Requirement(s): FR-REG-004
 * Specification: ADR-0015, API.md
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: double-taps and retries are the normal case on a bad network.
 */
import { describe, test } from "vitest";

describe.todo("registration idempotency", () => {
  test.todo("returns the original result for a replayed idempotency key");
  test.todo("rejects an idempotency key reused with a different payload");
  test.todo("converges parallel submissions from one contact to a single registration");});
