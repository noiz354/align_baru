/**
 * INTEGRATION TEST SKELETON - audio/access-control.test.ts
 * Layer: integration (real PostgreSQL / MinIO) · Owning task: T-AUDIO-008 · Requirement(s): FR-AUDIO-011
 * Specification: docs/media/STORAGE.md §3
 *
 * Rules for this layer (TESTING.md §1/§2): prove the invariant against the DATABASE, not against a mock.
 * Assert row counts and returned outcomes, never timing. Use deterministic interleaving for races - no
 * `sleep()`-based attempts (docs/testing/CONCURRENCY-TESTS.md writing guidance).
 * Why these behaviours: audio of a person's voice is personal data; playback is a privileged operation.
 */
import { describe, test } from "vitest";

describe.todo("audio access control", () => {
  test.todo("issues a signed URL only after the permission check for that asset");
  test.todo("bounds every URL by the TTL cap (<= 900 s)");
  test.todo("refuses a player for an INTERNAL asset outside authorized roles");
  test.todo("keeps signed URLs out of logs and out of pre-rendered HTML");});
