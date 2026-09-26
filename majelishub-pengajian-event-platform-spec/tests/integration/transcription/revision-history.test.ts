/**
 * INTEGRATION TEST SKELETON - transcription/revision-history.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-008 · Requirement(s): FR-TRANSCRIPT-011
 * Specification: ADR-0023
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the revision chain is how a dispute is reconstructed.
 */
import { describe, test } from "vitest";

describe.todo("revision history", () => {
  test.todo("appends a revision per save with author, timestamp and per-segment diff");
  test.todo("refuses a machine-authored revision after the draft");
  test.todo("keeps uncertainty markers attached to the revision that introduced them");});
