/**
 * TEST SKELETON - checkin/token-payload.test.ts
 * Layer: unit · Owning task: T-CHECKIN-003 · Requirement(s): FR-CHECKIN-011
 * Specification: ADR-0006, THREAT_MODEL T-01
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: a leaked QR image must be useless outside the running system.
 */
import { describe, test } from "vitest";

describe.todo("token payload properties", () => {
  test.todo("generated payloads contain no '@', no digit run >= 8 and no UUID-shaped substring");
  test.todo("payload length is fixed and entropy is >= 128 bits");
  test.todo("100k generations produce zero collisions");
  test.todo("the storage schema exposes no plaintext token column");
  test.todo("the printed page decodes to the opaque token only (no URL, no query parameters)");});
