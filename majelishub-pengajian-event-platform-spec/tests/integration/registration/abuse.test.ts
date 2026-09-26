/**
 * INTEGRATION TEST SKELETON - registration/abuse.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-REG-009 · Requirement(s): NFR-SEC-010
 * Specification: THREAT_MODEL T-06, SECURITY.md §8
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: a public registration endpoint must survive a burst without blocking a mosque's shared Wi-Fi.
 */
import { describe, test } from "vitest";

describe.todo("registration abuse limits", () => {
  test.todo("throttles repeated submissions from one contact hash");
  test.todo("does not throttle a shared network full of legitimate participants (per-contact dimension present)");
  test.todo("keeps the organizer-facing capacity state honest during an abuse burst");
  test.todo("does not reveal whether a contact is already registered");});
