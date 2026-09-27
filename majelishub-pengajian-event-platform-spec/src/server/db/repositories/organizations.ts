/**
 * Organization and membership repository - tenant-scoped data access.
 *
 * Where this belongs: `server/db/repositories` (ADR-0017 layer 2). Every function takes a `TenantScope`
 * as its first data parameter: an unscoped call cannot be expressed, which is what the type-level test
 * in `tests/integration/security/isolation.test.ts` asserts.
 *
 * Rules implemented:
 *   1. Scope comes from the caller (derived from the principal by `deriveScope`), never from request
 *      input.
 *   2. The WHERE clause always pins `organization_id` to the scope, so a cross-organization id returns
 *      zero rows and is reported as NOT_FOUND - never 403, never "exists but forbidden"
 *      (ADR-0017: existence privacy).
 *   3. Every denial emits an authorization event containing no object data.
 *   4. PLATFORM scope is honoured, because platform-level actions are gated separately by
 *      `platform.operate` with a recorded reason (AUTHZ-MATRIX §4.7).
 *
 * Exemption (ADR-0017 layer 5, listed here on purpose): the membership lookups are how a scope is
 * derived, so they necessarily run before a scope exists. They read identity data only - never tenant
 * content - and they are the only unscoped reads in this module.
 *
 * Task ownership: T-SEC-001. Role assignment/invitation flows are T-ORG-002/T-ORG-003.
 */
import { and, eq } from "drizzle-orm";
import { organizationMembers, organizations, type RoleKey } from "@/server/db/schema";
import type { DbHandle } from "@/server/db/client";
import { AppError } from "@/shared/contracts/errors";
import { isWithinScope, type TenantScope } from "@/shared/contracts/scope";
import { denyOutsideScope, tenantPredicate } from "@/server/db/tenant-query";

export type OrganizationKind = "MOSQUE" | "COMMUNITY" | "FOUNDATION" | "OTHER";
export type MembershipStatus = "INVITED" | "ACTIVE" | "REMOVED";

export interface OrganizationRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: OrganizationKind;
  readonly timezone: string;
  readonly isPublished: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MembershipRow {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly roles: readonly RoleKey[];
  readonly mosqueIds: readonly string[] | null;
  readonly status: MembershipStatus;
}

/**
 * Read one organization inside the caller's scope.
 *
 * @throws AppError(NOT_FOUND) when the organization is not in scope - including when it belongs to
 *   another tenant, which is indistinguishable from "does not exist" (ADR-0017).
 */
export async function findOrganizationById(
  handle: DbHandle,
  scope: TenantScope,
  organizationId: string,
  options?: { actorUserId?: string },
): Promise<OrganizationRow> {
  const rows = await handle
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, organizationId), tenantPredicate(organizations.id, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "organization", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row;
}

/** Read one organization by its public slug, inside the caller's scope. Same 404 rule as by id. */
export async function findOrganizationBySlug(
  handle: DbHandle,
  scope: TenantScope,
  slug: string,
  options?: { actorUserId?: string },
): Promise<OrganizationRow> {
  const rows = await handle
    .select()
    .from(organizations)
    .where(and(eq(organizations.slug, slug), tenantPredicate(organizations.id, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "organization", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row;
}

/**
 * Create a tenant. A platform-level action: the scope must be PLATFORM (AUTHZ-MATRIX §4.7). Onboarding
 * flows that let an organizer found their own organization are T-ORG-002/T-ORG-003.
 */
export async function createOrganization(
  handle: DbHandle,
  scope: TenantScope,
  input: { name: string; slug: string; kind?: OrganizationKind; timezone?: string },
): Promise<OrganizationRow> {
  if (scope.kind !== "PLATFORM") {
    return denyOutsideScope(scope, "organization", "DENIED_CROSS_ORGANIZATION");
  }
  const rows = await handle
    .insert(organizations)
    .values({
      name: input.name,
      slug: input.slug,
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.timezone ? { timezone: input.timezone } : {}),
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Programming error: insert returned no row");
  return row;
}

/**
 * Membership lookup used to derive a scope (see the exemption note in the header).
 * Returns null when the user is not an active member; the caller then has no scope, which the
 * permission layer turns into a denial (ADR-0017: absence of a scope is never a default).
 */
export async function findActiveMembership(
  handle: DbHandle,
  userId: string,
  organizationId: string,
): Promise<MembershipRow | null> {
  const rows = await handle
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "ACTIVE"),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, roles: row.roles as RoleKey[] };
}

/** All active memberships of a user across organizations (role/organization switching, T-ORG-003). */
export async function listActiveMembershipsForUser(handle: DbHandle, userId: string): Promise<MembershipRow[]> {
  const rows = await handle
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, "ACTIVE")));
  return rows.map((row) => ({ ...row, roles: row.roles as RoleKey[] }));
}

/** Grant a membership. Platform scope only in this task; organizer-driven grants are T-ORG-002. */
export async function createMembership(
  handle: DbHandle,
  scope: TenantScope,
  input: { organizationId: string; userId: string; roles: readonly RoleKey[]; mosqueIds?: readonly string[] },
): Promise<MembershipRow> {
  if (!isWithinScope(scope, { organizationId: input.organizationId })) {
    return denyOutsideScope(scope, "organization_member", "DENIED_CROSS_ORGANIZATION");
  }
  const rows = await handle
    .insert(organizationMembers)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      roles: [...input.roles],
      ...(input.mosqueIds ? { mosqueIds: [...input.mosqueIds] } : {}),
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Programming error: insert returned no row");
  return { ...row, roles: row.roles as RoleKey[] };
}

/** Convenience for tests and for the identity bootstrap: an unauthenticated insert is never allowed. */
export function assertOrganizationWritable(scope: TenantScope, organizationId: string): void {
  if (!isWithinScope(scope, { organizationId })) throw AppError.notFound();
}
