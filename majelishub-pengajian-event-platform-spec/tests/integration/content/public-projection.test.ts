/**
 * INTEGRATION TEST SKELETON - content/public-projection.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-012 · Requirement(s): FR-CONTENT-006
 * Specification: CONTENT.md §5
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: public pages are where an integrity mistake becomes permanent.
 */
import { describe, test } from "vitest";

describe.todo("public projections", () => {
  test.todo("serves only approved, published revisions");
  test.todo("returns nothing for an unpublished, withdrawn or INTERNAL item");
  test.todo("includes the provenance block (reviewer, date, revision, uncertainty count)");
  test.todo("contains no counts, ratings or rankings of people");});
