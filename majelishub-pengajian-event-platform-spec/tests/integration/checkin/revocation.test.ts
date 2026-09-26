/**
 * TEST SKELETON - token revocation and rotation
 * Layer: integration · Owning task: T-CHECKIN-011 · Requirement(s): FR-CHECKIN-013/016
 * Specification: docs/security/QR-SECURITY.md §4
 * Why these behaviours: revocation is the recovery path for a lost phone or a leaked code, so it must be immediate.
 */
import { describe, test } from "vitest";

describe.todo("revocation", () => {
  test.todo("a revoked token is refused on the next validation attempt");
  test.todo("revocation does not remove or invalidate an already recorded attendance");
  test.todo("re-issue issues a new token and revokes the previous one in one audited action");
  test.todo("mass revocation for an event revokes every active token and is audited once");
  test.todo("revoking an already revoked token is idempotent");});
