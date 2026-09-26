/** TODO TESTS — Phase 0 (TESTING.md §4.3, §4.9). Task: T-OFF-002. */
import { describe, it } from "vitest";

describe("offline and sync states in the UI (T-OFF-002)", () => {
  it.todo("shows the offline banner with the pending record count");
  it.todo("shows per-record sync state (LOCAL_ONLY, PENDING, SYNCING, SYNCED, REJECTED, DEFERRED)");
  it.todo("explains a rejected record with a reason and a next step, never a dead end");
  it.todo("disables digital payment creation with a clear message while offline");
  it.todo("keeps selling possible for cash while offline, without confirmation dialogs");
});
