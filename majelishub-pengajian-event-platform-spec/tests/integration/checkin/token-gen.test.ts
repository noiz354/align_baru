/**
 * TEST SKELETON - token generation at the database level
 * Layer: integration · Owning task: T-CHECKIN-003 · Requirement(s): FR-CHECKIN-011/012
 * Specification: ADR-0006, docs/security/QR-SECURITY.md §2
 * Why these behaviours: uniqueness and storage properties can only be proven against the real schema.
 */
import { describe, test } from "vitest";

describe.todo("token generation", () => {
  test.todo("100k generated tokens are unique under the unique index with zero retries needed");
  test.todo("the tokens table contains no plaintext column and only hash + display prefix");
  test.todo("a collision (forced by a test seam) regenerates a new token rather than lengthening it");});
