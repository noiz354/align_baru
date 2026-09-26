/**
 * TEST SKELETON - contracts/events.test.ts
 * Layer: unit · Owning task: T-ARCH-001 · Requirement(s): NFR-OBS-002
 * Specification: EVENTS.md §2
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: event payloads are the boundary where personal data most easily leaks into telemetry and audit.
 */
import { describe, test } from "vitest";

describe.todo("event payloads", () => {
  test.todo("rejects a payload containing free text or contact-like fields");
  test.todo("requires envelope ids and occurredAt on every event");
  test.todo("keeps every event name stable and covered by the union");});
