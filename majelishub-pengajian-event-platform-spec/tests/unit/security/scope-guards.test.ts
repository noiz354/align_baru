/**
 * UNIT TEST - security/scope-guards.test.ts
 * Layer: unit (pure) · Owning task: T-SEC-001 · Requirement(s): FR-ORG-003, NFR-SEC-003
 * Specification: ADR-0017, SECURITY.md §4, docs/security/AUTHZ-MATRIX.md §4.1
 *
 * These are the rules the repositories and the RLS policies both rely on, tested without I/O:
 * a scope never widens, a narrower scope never grants a broader object, and a malformed scope fails
 * closed instead of meaning "everything".
 */
import { describe, expect, test } from "vitest";
import {
  assertScopeUsable,
  assertWithinScope,
  eventScope,
  isWithinScope,
  mosqueScope,
  organizationScope,
  ownScope,
  platformScope,
  type TenantScope,
} from "@/shared/contracts/scope";
import { AppError, ErrorCode } from "@/shared/contracts/errors";

const ORG_A = "11111111-1111-7111-8111-111111111111";
const ORG_B = "22222222-2222-7222-8222-222222222222";
const MOSQUE_A1 = "33333333-3333-7333-8333-333333333333";
const MOSQUE_A2 = "44444444-4444-7444-8444-444444444444";
const EVENT_A1 = "55555555-5555-7555-8555-555555555555";
const OWNER = "user-1";

describe("isWithinScope", () => {
  test("an ORG scope covers its own organization and nothing else", () => {
    const scope = organizationScope(ORG_A);
    expect(isWithinScope(scope, { organizationId: ORG_A })).toBe(true);
    expect(isWithinScope(scope, { organizationId: ORG_B })).toBe(false);
  });

  test("a MOSQUE scope never grants an organization-level object or another mosque", () => {
    const scope = mosqueScope(ORG_A, MOSQUE_A1);
    expect(isWithinScope(scope, { organizationId: ORG_A, mosqueId: MOSQUE_A1 })).toBe(true);
    expect(isWithinScope(scope, { organizationId: ORG_A, mosqueId: MOSQUE_A2 })).toBe(false);
    // No mosque identifier on the resource means an organization-level object: denied, not passed.
    expect(isWithinScope(scope, { organizationId: ORG_A })).toBe(false);
    expect(isWithinScope(scope, { organizationId: ORG_B, mosqueId: MOSQUE_A1 })).toBe(false);
  });

  test("an EVENT scope is pinned to one event", () => {
    const scope = eventScope(ORG_A, EVENT_A1);
    expect(isWithinScope(scope, { organizationId: ORG_A, eventId: EVENT_A1 })).toBe(true);
    expect(isWithinScope(scope, { organizationId: ORG_A, eventId: "66666666-6666-7666-8666-666666666666" })).toBe(false);
    expect(isWithinScope(scope, { organizationId: ORG_A })).toBe(false);
  });

  test("an OWN scope only matches its own record", () => {
    const scope = ownScope(ORG_A, OWNER);
    expect(isWithinScope(scope, { organizationId: ORG_A, ownerId: OWNER })).toBe(true);
    expect(isWithinScope(scope, { organizationId: ORG_A, ownerId: "user-2" })).toBe(false);
    expect(isWithinScope(scope, { organizationId: ORG_A })).toBe(false);
  });

  test("a PLATFORM scope is not restricted to one organization", () => {
    const scope = platformScope(ORG_A);
    expect(isWithinScope(scope, { organizationId: ORG_B })).toBe(true);
  });

  test("a resource without an organization is never in scope", () => {
    expect(isWithinScope(organizationScope(ORG_A), { organizationId: "" })).toBe(false);
  });
});

describe("assertScopeUsable", () => {
  test("a malformed scope fails closed instead of widening access", () => {
    const broken: TenantScope[] = [
      { kind: "ORG", organizationId: "" },
      { kind: "ORG", organizationId: "   " },
      { kind: "MOSQUE", organizationId: ORG_A },
      { kind: "EVENT", organizationId: ORG_A },
      { kind: "OWN", organizationId: ORG_A },
    ];
    for (const scope of broken) {
      expect(() => assertScopeUsable(scope)).toThrow(AppError);
      expect(() => assertScopeUsable(scope)).toThrow(/organisasi|masjid|kegiatan|pemilik/);
    }
  });
});

describe("assertWithinScope", () => {
  test("a denial is NOT_FOUND and discloses nothing about the object", () => {
    const scope = organizationScope(ORG_A);
    let caught: unknown;
    try {
      assertWithinScope(scope, { organizationId: ORG_B, mosqueId: MOSQUE_A2 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    const appError = caught as AppError;
    expect(appError.code).toBe(ErrorCode.NOT_FOUND);
    expect(appError.httpStatus).toBe(404);
    // No identifier of the refused object, and no hint that it exists.
    expect(appError.message).not.toContain(ORG_B);
    expect(appError.message).not.toContain(MOSQUE_A2);
    expect(appError.message.toLowerCase()).not.toContain("forbidden");
  });

  test("an in-scope resource passes without throwing", () => {
    expect(() => assertWithinScope(organizationScope(ORG_A), { organizationId: ORG_A })).not.toThrow();
  });
});
