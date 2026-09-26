/**
 * INTEGRATION TEST SKELETON - feedback/anonymity.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-FEEDBACK-004 · Requirement(s): FR-FEEDBACK-003
 * Specification: ADR-0016
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: anonymity must survive a direct database insert, an export and an API request.
 */
import { describe, test } from "vitest";

describe.todo("feedback anonymity (integration)", () => {
  test.todo("fails an insert that carries both an anonymous flag and a registration link");
  test.todo("fails an update that would clear anonymity");
  test.todo("excludes all attribution fields from exports and projections");
  test.todo("stores no IP, fingerprint or session reference for anonymous rows");});
