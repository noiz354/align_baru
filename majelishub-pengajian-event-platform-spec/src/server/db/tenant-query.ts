/**
 * Tenant query helpers - the shared machinery behind every scoped repository.
 *
 * Where this belongs: `server/db`. Two responsibilities:
 *   1. `tenantPredicate` builds the WHERE fragment that pins a query to one organization
 *      (ADR-0017 layer 2 - the primary control).
 *   2. `denyOutsideScope` turns "not in scope" into the product's answer: NOT_FOUND (existence privacy)
 *      plus an authorization event that contains no object data.
 *
 * Why PLATFORM scope produces no predicate: platform-wide actions are authorized by `platform.operate`
 * with a recorded reason at the permission layer (docs/security/AUTHZ-MATRIX.md §4.7), and the RLS
 * policies carry the same exception. A PLATFORM scope is never derived from request input.
 *
 * Task ownership: T-SEC-001.
 */
import { eq, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { AppError } from "@/shared/contracts/errors";
import { isWithinScope, type TenantScope } from "@/shared/contracts/scope";
import { buildAuthorizationEvent, recordAuthorizationEvent, type AuthorizationOutcome } from "@/server/auth/authorization-events";

/** WHERE fragment pinning `column` to the scope's organization. Never returns "all tenants". */
export function tenantPredicate(column: AnyPgColumn, scope: TenantScope): SQL {
  return scope.kind === "PLATFORM" ? sql`true` : eq(column, scope.organizationId);
}

/**
 * Object-level check used before returning or mutating a single row.
 *
 * @returns true when the row is inside the scope
 */
export function withinScope(
  scope: TenantScope,
  resource: { organizationId: string; mosqueId?: string; eventId?: string; ownerId?: string },
): boolean {
  return isWithinScope(scope, resource);
}

/**
 * Record the denial and throw the only answer an out-of-scope caller may receive.
 *
 * The event carries the actor's own organization and the entity type - never the refused object's
 * identifier, never content (SECURITY.md §11).
 *
 * @throws AppError(NOT_FOUND) always
 */
export function denyOutsideScope(
  scope: TenantScope,
  targetType: string,
  outcome: AuthorizationOutcome = "DENIED_CROSS_ORGANIZATION",
  actorUserId?: string,
): never {
  recordAuthorizationEvent(
    buildAuthorizationEvent({
      outcome,
      actorUserId,
      organizationId: scope.organizationId,
      scopeKind: scope.kind,
      targetType,
      now: new Date(),
    }),
  );
  throw AppError.notFound();
}
