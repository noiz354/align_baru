/**
 * INTEGRATION TEST SKELETON - ops/smoke.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-OPS-002 · Requirement(s): NFR-OPS-001
 * Specification: DEPLOYMENT.md §1/§4
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the topology is only real if it starts as containers.
 */
import { describe, test } from "vitest";

describe.todo("container smoke", () => {
  test.todo("brings up proxy, app, worker, media, database and storage");
  test.todo("asserts the app image contains no ffmpeg and no shell-dependent entrypoint");
  test.todo("asserts the media container has no application database credentials");
  test.todo("completes an HTTP readiness check, a storage round-trip and a job enqueue/consume");
  test.todo("serves a clear maintenance page when the database is missing");});
