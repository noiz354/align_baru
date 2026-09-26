/** TODO TESTS — Phase 0 (TESTING.md §4.6). Tasks: T-CLOSE-001, T-CLOSE-003. */
import { describe, it } from "vitest";

describe("closing lifecycle (T-CLOSE-001/003)", () => {
  it.todo("keeps an offline closing PENDING_SYNC and editable until the server accepts it");
  it.todo("refuses a second closing for the same shift and returns the existing one (FR-SETTLE-010)");
  it.todo("makes an accepted closing immutable; later corrections are new audited records");
  it.todo("surfaces a late sale after closing as an exception, never as a silent rewrite");
  it.todo("flags unresolved verifications at closing without blocking the closing itself");
});
