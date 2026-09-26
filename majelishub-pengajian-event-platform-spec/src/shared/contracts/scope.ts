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
