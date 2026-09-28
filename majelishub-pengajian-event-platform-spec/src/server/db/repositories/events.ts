/**
 * Event repository — tenant-scoped.
 * Where this belongs: server/db/repositories. Every function takes TenantScope.
 * Narrow vertical for MajelisHub wave2: organization → mosque → event.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { kajianEvents } from "@/server/db/schema";
import type { DbHandle } from "@/server/db/client";
import { isWithinScope, type TenantScope } from "@/shared/contracts/scope";
import { denyOutsideScope, tenantPredicate } from "@/server/db/tenant-query";

export interface KajianEventRow {
  readonly id: string;
  readonly organizationId: string;
  readonly mosqueId: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly startsAt: Date | null;
  readonly endsAt: Date | null;
  readonly createdBy: string | null;
}

export interface CreateEventInput {
  readonly mosqueId: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  readonly createdBy?: string;
}

export async function createEvent(
  handle: DbHandle,
  scope: TenantScope,
  input: CreateEventInput,
): Promise<KajianEventRow> {
  if (!isWithinScope(scope, { organizationId: scope.organizationId })) {
    return denyOutsideScope(scope, "kajian_event", "DENIED_CROSS_ORGANIZATION");
  }
  // Verify mosque belongs to same org via FK, but repository layer will enforce via where later
  const rows = await handle
    .insert(kajianEvents)
    .values({
      organizationId: scope.organizationId,
      mosqueId: input.mosqueId,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Programming error: insert returned no row");
  return row as KajianEventRow;
}

export async function findEventById(
  handle: DbHandle,
  scope: TenantScope,
  eventId: string,
  options?: { actorUserId?: string },
): Promise<KajianEventRow> {
  const rows = await handle
    .select()
    .from(kajianEvents)
    .where(and(eq(kajianEvents.id, eventId), tenantPredicate(kajianEvents.organizationId, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "kajian_event", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row as KajianEventRow;
}

export async function findEventBySlug(
  handle: DbHandle,
  scope: TenantScope,
  slug: string,
  options?: { actorUserId?: string },
): Promise<KajianEventRow> {
  const rows = await handle
    .select()
    .from(kajianEvents)
    .where(and(eq(kajianEvents.slug, slug), tenantPredicate(kajianEvents.organizationId, scope)))
    .limit(1);
  const row = rows[0];
  if (!row) return denyOutsideScope(scope, "kajian_event", "DENIED_CROSS_ORGANIZATION", options?.actorUserId);
  return row as KajianEventRow;
}

export async function listEvents(handle: DbHandle, scope: TenantScope): Promise<KajianEventRow[]> {
  const rows = await handle
    .select()
    .from(kajianEvents)
    .where(tenantPredicate(kajianEvents.organizationId, scope))
    .orderBy(desc(kajianEvents.startsAt), asc(kajianEvents.title));
  return rows as KajianEventRow[];
}

export async function listEventsByMosque(
  handle: DbHandle,
  scope: TenantScope,
  mosqueId: string,
): Promise<KajianEventRow[]> {
  const rows = await handle
    .select()
    .from(kajianEvents)
    .where(and(eq(kajianEvents.mosqueId, mosqueId), tenantPredicate(kajianEvents.organizationId, scope)))
    .orderBy(desc(kajianEvents.startsAt));
  return rows as KajianEventRow[];
}
