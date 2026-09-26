/**
 * INTEGRATION TEST SKELETON - moderation/decisions.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-MOD-003 · Requirement(s): FR-MOD-003
 * Specification: CONTENT.md §6, SECURITY.md §4
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: moderation without separation of duties is just censorship with extra steps.
 */
import { describe, test } from "vitest";

describe.todo("moderation decisions", () => {
  test.todo("requires a reason for every decision and audits it");
  test.todo("refuses a decision by the publisher or reporter of the same item");
  test.todo("hides content without deleting the audit trail and is reversible");
  test.todo("informs the content owner without revealing an anonymous reporter");});
