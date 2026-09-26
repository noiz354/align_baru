/**
 * TEST SKELETON - checkin/token-format.test.ts
 * Layer: unit · Owning task: T-CHECKIN-001 · Requirement(s): FR-CHECKIN-003
 * Specification: ADR-0006, docs/security/QR-SECURITY.md
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the client must reject non-MajelisHub payloads before any network call.
 */
import { describe, test } from "vitest";

describe.todo("token grammar", () => {
  test.todo("accepts a well-formed token and rejects every near-miss (lowercase, wrong group size, ambiguous letters IL0U)");
  test.todo("rejects a URL, JSON payload or oversized input without a network call");
  test.todo("rejects a payload containing a phone-like digit run or an email");
  test.todo("normalises a typed short code without touching a scanned token");});
