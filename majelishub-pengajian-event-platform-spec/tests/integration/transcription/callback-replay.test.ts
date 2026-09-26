/**
 * INTEGRATION TEST SKELETON - transcription/callback-replay.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-002 · Requirement(s): FR-TRANSCRIPT-002
 * Specification: docs/transcription/PIPELINE.md §2
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: webhooks repeat, providers retry, and a replayed callback must not create a second draft.
 */
import { describe, test } from "vitest";
// Concurrency case: C9 (docs/testing/CONCURRENCY-TESTS.md)

describe.todo("callback replay", () => {
  test.todo("treats a replayed callback as a no-op returning the existing job state");
  test.todo("stores one draft transcript for one provider job");
  test.todo("rejects a callback whose signature or payload shape is invalid");});
