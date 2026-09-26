/** TODO TESTS — Phase 0 (TESTING.md §4.3, OFFLINE.md). Task: T-SALE-003. */
import { describe, it } from "vitest";

describe("offline sale replay (T-SALE-003)", () => {
  it.todo("counts a replayed cash sale exactly once");
  it.todo("converges when two devices submit the same client sale id");
  it.todo("assigns the server-derived business day, ignoring a wrong device clock");
  it.todo("defers a record whose dependency (its shift) has not been accepted yet");
  it.todo("never accepts a digital payment as PAID from the queue (INV-13)");
});
