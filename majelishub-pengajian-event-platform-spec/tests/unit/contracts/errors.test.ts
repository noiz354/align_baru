/**
 * TEST SKELETON - contracts/errors.test.ts
 * Layer: unit · Owning task: T-ARCH-004 · Requirement(s): NFR-OBS-004
 * Specification: API.md errors, src/shared/contracts/errors.ts
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: one error vocabulary keeps API shapes, audit entries and UI messages consistent.
 */
import { describe, test } from "vitest";

describe.todo("error taxonomy", () => {
  test.todo("maps every error code to an HTTP status");
  test.todo("keeps ALREADY_CHECKED_IN and ALREADY_REGISTERED success-shaped");
  test.todo("ensures no error message can carry a token, contact or transcript text");
  test.todo("rejects an unknown code at the type level (no stringly-typed errors)");});
