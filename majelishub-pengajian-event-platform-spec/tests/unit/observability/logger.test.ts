/**
 * TEST SKELETON - observability/logger.test.ts
 * Layer: unit · Owning task: T-OBS-002 · Requirement(s): NFR-OBS-002
 * Specification: OBSERVABILITY.md §5/§7
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the allow-list is what makes the telemetry privacy rules enforceable.
 */
import { describe, test } from "vitest";

describe.todo("logger allow-list", () => {
  test.todo("drops unknown attributes and increments the dropped-attribute counter");
  test.todo("refuses free-text fields and only accepts enum-like values");
  test.todo("emits the documented fields for a check-in log line");
  test.todo("keeps the application running when the exporter is unreachable");});
