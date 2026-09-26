/**
 * INTEGRATION TEST SKELETON - checkin/context-guard.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-CHECKIN-006 · Requirement(s): FR-CHECKIN-002
 * Specification: CHECKIN.md §2
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: same mosque, same evening, two events - the wrong-event mistake is inevitable without a guard.
 */
import { describe, test } from "vitest";

describe.todo("context guard", () => {
  test.todo("refuses a scan bound to another event and names it");
  test.todo("keeps the context bar authoritative after a reschedule during a session");
  test.todo("invalidates the previous context when a device is re-bound");});
