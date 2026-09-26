/**
 * TEST SKELETON - harness/selftest.test.ts
 * Layer: unit · Owning task: T-TEST-001 · Requirement(s): NFR-OPS-001
 * Specification: TESTING.md §2/§9
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the test harness itself must be trustworthy: if integration tests silently skip, every later 'green' is meaningless.
 */
import { describe, test } from "vitest";

describe.todo("harness selftest", () => {
  test.todo("fails loudly when the Postgres container is unavailable instead of skipping");
  test.todo("applies migrations and seeds the tiny fixture set");
  test.todo("detects a deliberately flaky test and reports its seed");
  test.todo("runs each integration suite in an isolated schema");});
