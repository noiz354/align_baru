import { getDb } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { listMosques } from "@/server/db/repositories/mosques";
import { findActiveMembership } from "@/server/db/repositories/organizations";
import { requirePermission } from "@/server/auth/permissions";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ orgId: string }> }): Promise<Response> {
  const { orgId } = await ctx.params;
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: "Unauthenticated", code: "UNAUTHENTICATED" }, { status: 401 });
  const userId = session.userId;
  const scope = organizationScope(orgId);
  const db = getDb();
  try {
    const membership = await findActiveMembership(db, userId, orgId);
    if (!membership) return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    try {
      requirePermission({
        actor: { userId, roles: membership.roles as any, scope },
        permission: "mosque.read",
        scopeKind: scope.kind,
        resource: { organizationId: orgId },
      });
    } catch (permErr: any) {
      return Response.json({ error: String(permErr?.message ?? permErr), code: permErr?.code ?? "FORBIDDEN" }, { status: permErr?.status ?? 403 });
    }
    const mosques = await listMosques(db, scope);
    return Response.json({ mosques });
  } catch (e: any) {
    const status = e?.code === "NOT_FOUND" || e?.status === 404 ? 404 : 500;
    return Response.json({ error: String(e?.message ?? e), code: e?.code ?? "UNKNOWN" }, { status });
  }
}
