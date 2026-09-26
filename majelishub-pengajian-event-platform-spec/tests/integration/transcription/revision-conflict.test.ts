/**
 * INTEGRATION TEST SKELETON - transcription/revision-conflict.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-008 · Requirement(s): FR-TRANSCRIPT-011
 * Specification: ADR-0023
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: losing a reviewer's edits is unacceptable; so is silently choosing a winner.
 */
import { describe, test } from "vitest";
// Concurrency case: C6 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("revision conflict", () => {
  test.todo("lets one of two saves from the same base version succeed and returns 409 with a diff to the other");
  test.todo("never overwrites a saved revision (append-only)");
  test.todo("keeps the machine draft (revision #1) retrievable and immutable");});
