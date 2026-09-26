/** TODO TESTS — Phase 0 (API.md §0, ADR-0013). Task: T-FOUND-004. */
import { describe, it } from "vitest";

describe("idempotency (T-FOUND-004)", () => {
  it.todo("returns the original response for a replayed key, marked as a replay");
  it.todo("rejects a different payload under the same key with IDEMPOTENCY_MISMATCH");
  it.todo("creates exactly one record for two concurrent identical requests");
  it.todo("expires keys according to the retention rule without breaking replays inside the window");
});
