/**
 * Mosque repository - the first tenant-scoped aggregate and the table the isolation suite exercises.
 *
 * Where this belongs: `server/db/repositories`. Every function's first data parameter is a
 * `TenantScope`; there is no unscoped variant, and no variant that takes an organization id from the
 * caller (ADR-0017 layer 2: "no endpoint accepts an unscoped id without an ownership check").
 *
 * Only identity columns exist in this task. Address, coordinates, venues, facilities, contacts and the
 * public discovery page are T-MOSQUE-001/T-MOSQUE-002/T-MOSQUE-003.
 *
 * Failure cases: unknown id/slug and another tenant's id/slug produce the same NOT_FOUND; a write
 * outside the scope is refused before any statement is issued; a database error propagates (never an
 * empty success).
 *
 * Task ownership: T-SEC-001.
 */
import { and, asc, eq } from "drizzle-orm";
import { mosques } from "@/server/db/schema";
import type { DbHandle } from "@/server/db/client";
import { isWithinScope, type TenantScope } from "@/shared/contracts/scope";
import { denyOutsideScope, tenantPredicate } from "@/server/db/tenant-query";

export type MosqueKind = "MASJID" | "MUSHOLLA" | "SURAU" | "HALL" | "CAMPUS" | "OFFICE" | "OTHER";

export interface MosqueRow {
  readonly id: string;
  readonly organizationId: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: MosqueKind;
  readonly timezone: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMosqueInput {
  readonly name: string;
  readonly slug: string;
  readonly kind?: MosqueKind;
  readonly timezone?: string;
}

/** Create a mosque inside the caller's scope; a MOSQUE-scoped actor cannot create one elsewhere. */
export async function createMosque(
  handle: DbHandle,
  scope: TenantScope,
  input: CreateMosqueInput,
): Promise<MosqueRow> {
  if (!isWithinScope(scope, { organizationId: scope.organizationId })) {
    return denyOutsideScope(scope, "mosque", "DENIED_CROSS_ORGANIZATION");
  }
  const rows = await handle
    .insert(mosques)
    .values({
      organizationId: scope.organizationId,
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
 * Fetch by id. A cross-organization id yields zero rows -> NOT_FOUND, with an authorization event and
 * no existence disclosure.
 */
export async function findMosqueById(
  handle: DbHandle,
  scope: TenantScope,
  mosqueId: string,
  options?: { actorUserId?: string },
): Promise<MosqueRow> {
  const rows = await handle
    .select()
    .from(mosques)
    .where(and(eq(mosques.id, mosqueId), tenantPredicate(mosques.organizationId, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "mosque", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row;
}

/** Fetch by public slug. Slugs are unique per organization, so the scope is part of the lookup. */
export async function findMosqueBySlug(
  handle: DbHandle,
  scope: TenantScope,
  slug: string,
  options?: { actorUserId?: string },
): Promise<MosqueRow> {
  const rows = await handle
    .select()
    .from(mosques)
    .where(and(eq(mosques.slug, slug), tenantPredicate(mosques.organizationId, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "mosque", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row;
}

/**
 * List mosques visible in the scope. A MOSQUE-scoped actor sees only their own mosque; an ORG-scoped
 * actor sees the whole organization; a cross-organization request returns zero rows (never another
 * tenant's data, never an error).
 */
export async function listMosques(handle: DbHandle, scope: TenantScope): Promise<MosqueRow[]> {
  const rows = await handle
    .select()
    .from(mosques)
    .where(
      scope.kind === "MOSQUE" && scope.mosqueId !== undefined
        ? and(tenantPredicate(mosques.organizationId, scope), eq(mosques.id, scope.mosqueId))
        : tenantPredicate(mosques.organizationId, scope),
    )
    .orderBy(asc(mosques.name));
  return rows;
}
