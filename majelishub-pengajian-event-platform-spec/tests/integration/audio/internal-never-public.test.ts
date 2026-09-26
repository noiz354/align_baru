/**
 * INTEGRATION TEST SKELETON - audio/internal-never-public.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-AUDIO-008 · Requirement(s): FR-CONTENT-007
 * Specification: CONTENT.md policies
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: an INTERNAL recording must never leak through any path.
 */
import { describe, test } from "vitest";

describe.todo("internal policy", () => {
  test.todo("produces no public projection, no player and no search entry for an INTERNAL asset");
  test.todo("refuses publication attempts on an INTERNAL asset with a clear reason");
  test.todo("still allows authorized roles to read it with their own permission");});
