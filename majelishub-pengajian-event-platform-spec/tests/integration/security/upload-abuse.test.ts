/**
 * INTEGRATION TEST SKELETON - security/upload-abuse.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-SEC-005 · Requirement(s): NFR-SEC-009
 * Specification: THREAT_MODEL T-10, abuse fixtures
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the only component running a third-party binary on user bytes must never see unvalidated input.
 */
import { describe, test } from "vitest";

describe.todo("upload abuse corpus", () => {
  test.todo("rejects disguised, truncated, oversized and bomb-like payloads with distinct codes");
  test.todo("leaves no object and enqueues no job for a rejected upload");
  test.todo("runs the media command with no network access and a non-root user");
  test.todo("records the ffmpeg build string on any produced asset");});
