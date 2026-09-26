/**
 * TEST SKELETON - browser/transcript/arabic-rendering.test.ts
 * Layer: browser · Owning task: T-TRANSCRIPT-014 · Requirement(s): NFR-I18N-001
 * Specification: docs/transcription/CODE-SWITCHING.md §5
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: Arabic in a mixed-direction paragraph is where a transcript becomes unreadable or subtly wrong.
 */
import { describe, test } from "vitest";

describe.todo("Arabic rendering", () => {
  test.todo("renders Arabic segments RTL with lang=ar and no clipped diacritics");
  test.todo("keeps surrounding Indonesian text order correct (bidi)");
  test.todo("preserves characters when copying out of the page");
  test.todo("does not truncate harakat in large-text mode");});
