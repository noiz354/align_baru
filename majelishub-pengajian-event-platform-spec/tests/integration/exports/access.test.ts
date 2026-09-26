/**
 * INTEGRATION TEST SKELETON - exports/access.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-OPS-006 · Requirement(s): NFR-OPS-002
 * Specification: TASKS.md T-OPS-006, THREAT_MODEL T-22
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: an export is a copy of personal data that outlives the request if nobody watches it.
 */
import { describe, test } from "vitest";

describe.todo("export access", () => {
  test.todo("refuses a cross-organization export");
  test.todo("contains no contact fields unless explicitly selected (and audits the selection)");
  test.todo("deletes the export after 7 days with count verification");
  test.todo("makes an expired export unreachable");});
