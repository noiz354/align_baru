import { getDb } from "@/server/db/client";
import { findOrganizationById, listActiveMembershipsForUser } from "@/server/db/repositories/organizations";
import { getSession } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { organizationScope } from "@/shared/contracts/scope";

export const dynamic = "force-dynamic";

// Identity is always resolved from the verified session; caller-supplied user IDs are ignored.
// Each result also passes the tenant permission matrix and a scoped organization lookup.
export async function GET(request: Request): Promise<Response> {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: "Unauthenticated", code: "UNAUTHENTICATED" }, { status: 401 });
  const userId = session.userId;
  const db = getDb();
  try {
    const memberships = await listActiveMembershipsForUser(db, userId);
    const accessible: unknown[] = [];
    for (const membership of memberships) {
      const scope = organizationScope(membership.organizationId);
      try {
        requirePermission({
          actor: { userId, roles: membership.roles as any, scope },
          permission: "organization.read",
          scopeKind: scope.kind,
          resource: { organizationId: membership.organizationId },
        });
        accessible.push(await findOrganizationById(db, scope, membership.organizationId, { actorUserId: userId }));
      } catch {
        // A membership without organization.read does not reveal the organization in this list.
      }
    }
    return Response.json({ organizations: accessible });
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
