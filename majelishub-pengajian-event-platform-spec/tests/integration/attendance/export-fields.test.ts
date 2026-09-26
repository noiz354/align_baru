/**
 * INTEGRATION TEST SKELETON - attendance/export-fields.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-ATTEND-006 · Requirement(s): FR-ATTEND-005
 * Specification: ATTENDANCE.md §5, PRIVACY.md §4
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: an export must not become a contact list.
 */
import { describe, test } from "vitest";

describe.todo("attendance export fields", () => {
  test.todo("excludes contact fields by default");
  test.todo("requires the explicit selection, permission and reason to include contacts");
  test.todo("audits the field selection with the actor and event");
  test.todo("states the as-of time when generated during an open window");});
