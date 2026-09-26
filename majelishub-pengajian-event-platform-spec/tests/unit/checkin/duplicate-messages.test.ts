/**
 * TEST SKELETON - checkin/duplicate-messages.test.ts
 * Layer: unit · Owning task: T-CHECKIN-018 · Requirement(s): NFR-ETH-003
 * Specification: CHECKIN.md abuse, THREAT_MODEL T-03
 *
 * Phase 0 rule: every test is `describe.todo`/`test.todo` with the REQUIRED BEHAVIOUR in the title.
 * Implementing the owning task means replacing the todos with real tests - they are the acceptance
 * checklist (AGENTS.md §5.4). A test must never be written to pass trivially: mocking the thing being
 * constrained (a database constraint, a token hash, the publication gate) is prohibited (TESTING.md §1).
 *
 * Why these behaviours: duplicate scans must be handled without accusing a participant.
 */
import { describe, test } from "vitest";

describe.todo("duplicate wording", () => {
  test.todo("uses neutral wording for a duplicate scan (no accusation, no personal flag)");
  test.todo("never exposes a per-participant duplicate history");
  test.todo("keeps duplicate metrics aggregate-only per event and per device");});
