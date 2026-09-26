/**
 * INTEGRATION TEST SKELETON - notifications/channel-policy.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-NOTIF-004 · Requirement(s): FR-NOTIF-010
 * Specification: NOTIFICATIONS.md §§4/6
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: the channel decides whether a code is a credential or a public post.
 */
import { describe, test } from "vitest";

describe.todo("notification channel policy", () => {
  test.todo("sends a token only through an access-controlled channel");
  test.todo("substitutes a single-use, short-lived redemption link in uncontrolled channels");
  test.todo("deletes the intent or skips a send when the contact is withdrawn or the recipient is absent");
  test.todo("respects quiet hours except for the documented essential class");});
