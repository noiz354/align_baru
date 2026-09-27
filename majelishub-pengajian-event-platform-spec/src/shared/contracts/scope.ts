/**
 * Tenant scope - the value every data access requires.
 *
 * Where this belongs: `shared/contracts` so repositories, services and jobs all speak the same type.
 * Specification: ADR-0017 (TenantScope is a required parameter; cross-organization access returns 404).
 *
 * Invariants:
 *   1. A scope is derived from the authenticated principal, never from client input.
 *   2. A repository function cannot be called without a scope (compile-time, not convention).
 *   3. Missing/empty scope fails closed (T-SEC-001); it is never treated as "all organizations".
 *   4. RLS session variables mirror the scope inside each transaction (defence in depth).
 * Security: this type is the first control against IDOR/BOLA; the database is the second.
 * Privacy: narrow scopes mean participant contact data is reachable only in a few, audited actions.
 */
export type ScopeKind = "PLATFORM" | "ORG" | "MOSQUE" | "EVENT" | "OWN";

export interface TenantScope {
  readonly kind: ScopeKind;
  readonly organizationId: string;
  readonly mosqueId?: string;
  readonly eventId?: string;
  /** Principal for `OWN` scopes (participant capability) - never a user id from a request body. */
  readonly ownerId?: string;
}

/** Narrowing helpers must refuse rather than widen. Implementation is T-SEC-001. */
export interface ScopeGuards {
  assertWithin(scope: TenantScope, resource: { organizationId: string; mosqueId?: string; eventId?: string }): void;
}

/*
 * IMPLEMENTATION (T-SEC-001, delivered 2026-09-27)
 * -----------------------------------------------------------------------------------------------
 * The rules below are pure: no I/O, no clock, no framework (ARCHITECTURE.md §imports). They are the
 * single definition of "is this resource inside this scope"; the database layer (RLS) is the second
 * layer, and both are proved independently by tests/integration/security/isolation.test.ts.
 *
 * Note on `organizationId` for PLATFORM scopes: the field stays required so that every scope value is
 * attributable in the audit trail. For `kind === "PLATFORM"` it names the actor's home organization and
 * does not restrict access - platform-wide actions are gated separately by `platform.operate` with a
 * recorded reason (docs/security/AUTHZ-MATRIX.md §4.7).
 */

import { AppError } from "./errors";

/** The object a scope is being checked against. Identifiers only - never content. */
export interface ScopedResource {
  readonly organizationId: string;
  readonly mosqueId?: string;
  readonly eventId?: string;
  /** Present on records a participant owns (registration, feedback, capability). */
  readonly ownerId?: string;
}

/**
 * Fail-closed structural validation of a scope value.
 *
 * A malformed scope is a programming error, not a user error: it throws rather than widening access
 * (invariant 3 above). Callers that received the scope from `deriveScope` never hit this.
 *
 * @throws AppError(VALIDATION_FAILED) when the scope cannot possibly describe one tenant
 */
export function assertScopeUsable(scope: TenantScope): void {
  if (typeof scope.organizationId !== "string" || scope.organizationId.trim() === "") {
    throw AppError.validation("Sesi tidak memiliki organisasi yang aktif.");
  }
  if (scope.kind === "MOSQUE" && (scope.mosqueId === undefined || scope.mosqueId.trim() === "")) {
    throw AppError.validation("Sesi tidak memiliki masjid yang aktif.");
  }
  if (scope.kind === "EVENT" && (scope.eventId === undefined || scope.eventId.trim() === "")) {
    throw AppError.validation("Sesi tidak memiliki kegiatan yang aktif.");
  }
  if (scope.kind === "OWN" && (scope.ownerId === undefined || scope.ownerId.trim() === "")) {
    throw AppError.validation("Sesi tidak memiliki pemilik data.");
  }
}

/**
 * Pure predicate: does `resource` fall inside `scope`?
 *
 * Deliberately conservative: a scope that is narrower than the resource it is asked about denies
 * access (a MOSQUE scope never grants an organization-level object; an EVENT scope never grants a
 * mosque-level object). Absence of an identifier on the resource is a denial, not a pass.
 */
export function isWithinScope(scope: TenantScope, resource: ScopedResource): boolean {
  assertScopeUsable(scope);
  if (typeof resource.organizationId !== "string" || resource.organizationId.trim() === "") {
    return false;
  }
  if (scope.kind === "PLATFORM") {
    return true;
  }
  if (scope.organizationId !== resource.organizationId) {
    return false;
  }
  switch (scope.kind) {
    case "ORG":
      return true;
    case "MOSQUE":
      return resource.mosqueId !== undefined && resource.mosqueId === scope.mosqueId;
    case "EVENT":
      return resource.eventId !== undefined && resource.eventId === scope.eventId;
    case "OWN":
      return resource.ownerId !== undefined && resource.ownerId === scope.ownerId;
    default: {
      // Exhaustiveness guard: a new ScopeKind must be handled here, never defaulted to "allow".
      const unhandled: never = scope.kind;
      throw AppError.validation("Cakupan akses tidak dikenal.", undefined, unhandled);
    }
  }
}

/**
 * Guard used by repositories and services before returning or mutating a row.
 *
 * Denials are reported as NOT_FOUND (ADR-0017: cross-organization access is a 404 with no existence
 * disclosure), never FORBIDDEN. The thrown error carries no resource identifiers.
 *
 * @throws AppError(NOT_FOUND) when the resource is outside the scope
 */
export function assertWithinScope(scope: TenantScope, resource: ScopedResource): void {
  if (!isWithinScope(scope, resource)) {
    throw AppError.notFound();
  }
}

/** Injectable form of the guard (the contract declared above); useful for tests and for feature code. */
export const scopeGuards: ScopeGuards = {
  assertWithin(scope: TenantScope, resource: { organizationId: string; mosqueId?: string; eventId?: string }): void {
    assertWithinScope(scope, resource);
  },
};

/** Constructors. A scope is always built by `deriveScope` from the principal; these are its toolkit. */
export function organizationScope(organizationId: string): TenantScope {
  return { kind: "ORG", organizationId };
}

export function mosqueScope(organizationId: string, mosqueId: string): TenantScope {
  return { kind: "MOSQUE", organizationId, mosqueId };
}

export function eventScope(organizationId: string, eventId: string, mosqueId?: string): TenantScope {
  return mosqueId === undefined
    ? { kind: "EVENT", organizationId, eventId }
    : { kind: "EVENT", organizationId, eventId, mosqueId };
}

export function ownScope(organizationId: string, ownerId: string): TenantScope {
  return { kind: "OWN", organizationId, ownerId };
}

export function platformScope(homeOrganizationId: string): TenantScope {
  return { kind: "PLATFORM", organizationId: homeOrganizationId };
}
