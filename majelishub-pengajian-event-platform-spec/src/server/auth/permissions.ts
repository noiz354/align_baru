/**
 * Authorization enforcement - the single choke point.
 *
 * Where this belongs: server layer; every route, Server Action and job calls it. This path is cited by
 * docs/security/AUTHZ-MATRIX.md as the implementation site.
 * Specification: SECURITY.md §4, docs/security/AUTHZ-MATRIX.md (9 roles x resources, scopes
 *   PLATFORM/ORG/MOSQUE/EVENT/OWN, `✓*` = reason >= 8 chars required and audited), TASKS.md T-SEC-002.
 *
 * Invariants:
 *   1. No route, action or job performs its own role comparison - a static test enforces this.
 *   2. Unauthorized access to another organization's object returns NOT_FOUND (no existence disclosure).
 *   3. Separation of duties: a reviewer cannot approve their own revision; moderation decisions are
 *      platform-only; no role can grant itself a role.
 *   4. Reason-required permissions fail without a stored reason of >= 8 characters.
 *   5. Every denial and every reason-required grant writes an audit entry (T-SEC-007).
 * Failure cases: unknown permission key (fail closed + alert) · role lookup failure (deny) · broken scope
 *   chain (deny) · missing actor (deny).
 * Task ownership: T-SEC-002 (enforcement), T-SEC-001 (scope), T-SEC-007 (audit linkage).
 */
import type { Actor, PermissionKey } from "@/shared/contracts/permissions";
import type { TenantScope, ScopeKind } from "@/shared/contracts/scope";

export interface AuthorizationContext {
  readonly actor: Actor;
  readonly permission: PermissionKey;
  readonly scopeKind: ScopeKind;
  readonly resource?: { readonly organizationId: string; readonly mosqueId?: string; readonly eventId?: string };
  readonly reason?: string;
}

/**
 * @throws Error("Not implemented: T-SEC-002") - and, once implemented, a typed ForbiddenError or
 * NotFoundError (never a generic error, never a silent allow).
 */
export function requirePermission(context: AuthorizationContext): void {
  throw new Error("Not implemented: T-SEC-002");
}

/** Derives the tenant scope from the authenticated principal - never from request input (ADR-0017). */
/** @throws Error("Not implemented: T-SEC-001") */
export function deriveScope(actor: Actor): TenantScope {
  throw new Error("Not implemented: T-SEC-001");
}

/**
 * Role -> permission mapping is DATA (a table), so the generated matrix test can walk every row.
 * @throws Error("Not implemented: T-SEC-002")
 */
export function permissionsForRole(role: string): readonly PermissionKey[] {
  throw new Error("Not implemented: T-SEC-002");
}
