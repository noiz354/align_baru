/**
 * INTEGRATION TEST SKELETON - transcription/publish-gate.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-TRANSCRIPT-012 · Requirement(s): FR-TRANSCRIPT-006/010
 * Specification: ADR-0012, docs/product/CONTENT-INTEGRITY.md
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the database is the last line of defence for the integrity promise.
 */
import { describe, test } from "vitest";

describe.todo("publication gate (integration)", () => {
  test.todo("fails a direct attempt to set PUBLISHED on a machine draft (API and database)");
  test.todo("enforces the CHECK constraint pairing published_at with approved_by and approved_revision_id");
  test.todo("serves the approved revision and only the approved revision");
  test.todo("keeps a published item's output unchanged after a later edit until re-approval");
  test.todo("removes an unpublished item from search and refuses audio signing");});
