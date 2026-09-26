/**
 * INTEGRATION TEST SKELETON - feedback/reporting.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-FEEDBACK-006 · Requirement(s): FR-FEEDBACK-006
 * Specification: FEEDBACK.md §5/§6
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: small mosques are exactly where a leaked comment does the most damage.
 */
import { describe, test } from "vitest";

describe.todo("feedback reporting", () => {
  test.todo("applies n < 5 suppression at the projection layer (no API can bypass it)");
  test.todo("reports denominators and as-of times");
  test.todo("hides a moderated comment from reports while retaining the row and the reason");
  test.todo("exposes no speaker comparison in any view");});
