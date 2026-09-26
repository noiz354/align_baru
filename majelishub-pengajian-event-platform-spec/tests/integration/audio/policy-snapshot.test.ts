/**
 * INTEGRATION TEST SKELETON - audio/policy-snapshot.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-AUDIO-002 · Requirement(s): FR-AUDIO-013
 * Specification: AUDIO.md §2, PRIVACY.md §5
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: consent cannot be retroactively changed.
 */
import { describe, test } from "vitest";

describe.todo("recording policy snapshot", () => {
  test.todo("keeps the session's policy after the event policy changes");
  test.todo("refuses to start without an acknowledgement and re-requires it after a refresh");
  test.todo("records the acknowledgement actor and time in the audit trail");});
