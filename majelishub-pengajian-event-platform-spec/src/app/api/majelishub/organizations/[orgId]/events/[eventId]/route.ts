import { getDb } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { findEventById } from "@/server/db/repositories/events";
import { findActiveMembership } from "@/server/db/repositories/organizations";
import { requirePermission } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ orgId: string; eventId: string }> }): Promise<Response> {
  const { orgId, eventId } = await ctx.params;
  const url = new URL(request.url);
  const userId = request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin";
  const scope = organizationScope(orgId);
  const db = getDb();
  try {
    const membership = await findActiveMembership(db, userId, orgId);
    if (!membership) return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    try {
      requirePermission({
        actor: { userId, roles: membership.roles as any, scope },
        permission: "event.read",
        scopeKind: scope.kind,
        resource: { organizationId: orgId, eventId },
      });
    } catch (permErr: any) {
      return Response.json({ error: String(permErr?.message ?? permErr), code: permErr?.code ?? "FORBIDDEN" }, { status: permErr?.status ?? 403 });
    }
    const event = await findEventById(db, scope, eventId, { actorUserId: userId });
    return Response.json({ event });
  } catch (e: any) {
    const code = e?.code ?? e?.name;
    const status = code === "NOT_FOUND" || e?.status === 404 ? 404 : 500;
    return Response.json({ error: String(e?.message ?? e), code: code ?? "UNKNOWN" }, { status });
  }
}
