/**
 * TEST SKELETON - content/link-policy.test.ts
 * Layer: unit · Owning task: T-CONTENT-003 · Requirement(s): FR-CONTENT-003
 * Specification: CONTENT.md §6, THREAT_MODEL T-23
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: the app must not become a distribution or tracking vector.
 */
import { describe, test } from "vitest";

describe.todo("link policy", () => {
  test.todo("rejects shorteners, javascript: URLs and open-redirect parameters");
  test.todo("rejects remote images and tracking pixels in materials");
  test.todo("requires rel=noopener noreferrer for outbound links");});
