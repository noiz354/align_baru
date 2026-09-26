/**
 * INTEGRATION TEST SKELETON - providers/adapter-contract.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-001 · Requirement(s): FR-TRANSCRIPT-003
 * Specification: docs/transcription/PIPELINE.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the port is what makes provider choice reversible.
 */
import { describe, test } from "vitest";

describe.todo("provider adapter contract", () => {
  test.todo("satisfies the port for a successful fixture response");
  test.todo("classifies a partial, malformed and empty response distinctly");
  test.todo("stores the model version and confidence metadata unaltered");
  test.todo("never sends participant names, contacts or attendee data");});
