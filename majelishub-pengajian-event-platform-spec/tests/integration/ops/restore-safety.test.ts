/**
 * INTEGRATION TEST SKELETON - ops/restore-safety.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-OPS-006 · Requirement(s): NFR-OPS-002
 * Specification: docs/operations/BACKUP-RESTORE.md §2
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a restored copy must never message real people or delete their data.
 */
import { describe, test } from "vitest";

describe.todo("restore safety", () => {
  test.todo("starts a restored instance with jobs, notifications, retention and publishing disabled");
  test.todo("requires rotated credentials for a restored environment");
  test.todo("verifies constraint sanity after restore (no duplicate attendance, no published item without an approver)");});
