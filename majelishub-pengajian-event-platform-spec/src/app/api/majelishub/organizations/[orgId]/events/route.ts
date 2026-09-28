import { getDb, withTransaction } from "@/server/db/client";
import { organizationScope } from "@/shared/contracts/scope";
import { listEvents, createEvent } from "@/server/db/repositories/events";
import { requirePermission } from "@/server/auth/permissions";
import { writeAuditEntry } from "@/server/audit/writer";
import { findActiveMembership } from "@/server/db/repositories/organizations";

export const dynamic = "force-dynamic";

// GET list events for org (tenant-scoped, RLS)
export async function GET(request: Request, ctx: { params: Promise<{ orgId: string }> }): Promise<Response> {
  const { orgId } = await ctx.params;
  const url = new URL(request.url);
  const userId = request.headers.get("x-majelishub-user") || url.searchParams.get("userId") || "majelishub-jakarta-admin";
  const scope = organizationScope(orgId);
  const db = getDb();
  try {
    // Permission: event.read (check via requirePermission — narrow vertical)
    // For demo, fetch membership to get roles
    const membership = await findActiveMembership(db, userId, orgId);
    if (!membership) return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    try {
      requirePermission({
        actor: { userId, roles: membership.roles as any, scope },
        permission: "event.read",
        scopeKind: scope.kind,
        resource: { organizationId: orgId },
      });
    } catch (permErr: any) {
      return Response.json({ error: String(permErr?.message ?? permErr), code: permErr?.code ?? "FORBIDDEN" }, { status: permErr?.status ?? 403 });
    }
    const events = await listEvents(db, scope);
    return Response.json({ events });
  } catch (e: any) {
    const status = e?.code === "NOT_FOUND" || e?.status === 404 ? 404 : 500;
    return Response.json({ error: String(e?.message ?? e) }, { status });
  }
}

// POST create event (requires event.write, audit, rate-limit via durable counter - simplified)
export async function POST(request: Request, ctx: { params: Promise<{ orgId: string }> }): Promise<Response> {
  const { orgId } = await ctx.params;
  const userId = request.headers.get("x-majelishub-user") || "majelishub-jakarta-organizer";
  const scope = organizationScope(orgId);
  const db = getDb();
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const title = String(body?.title ?? "").trim();
  const slug = String(body?.slug ?? "").trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const mosqueId = String(body?.mosqueId ?? "").trim();
  const description = body?.description ? String(body.description) : undefined;
  if (!title || !mosqueId) return Response.json({ error: "title and mosqueId required" }, { status: 400 });
  if (title.length < 3) return Response.json({ error: "title too short" }, { status: 400 });

  try {
    const membership = await findActiveMembership(db, userId, orgId);
    if (!membership) return Response.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    // Permission check: event.write
    try {
      requirePermission({
        actor: { userId, roles: membership.roles as any, scope },
        permission: "event.write",
        scopeKind: scope.kind,
        resource: { organizationId: orgId, mosqueId },
      });
    } catch (permErr: any) {
      return Response.json({ error: String(permErr?.message ?? permErr), code: permErr?.code ?? "FORBIDDEN" }, { status: permErr?.status ?? 403 });
    }

    // Rate-limit: simple — for PGlite dev, just allow (durable counter would be checked here)
    // Create via transaction with audit
    const event = await withTransaction(scope, async (tx) => {
      const ev = await createEvent(tx, scope, {
        mosqueId,
        slug,
        title,
        ...(description === undefined ? {} : { description }),
        createdBy: userId,
      });
      await writeAuditEntry(
        {
          actionKey: "event.write",
          organizationId: orgId,
          actorUserId: userId,
          actorRole: membership.roles[0],
          scopeKind: scope.kind,
          targetType: "kajian_event",
          targetId: ev.id,
        },
        tx,
      );
      return ev;
    }, { userId });

    return Response.json({ event }, { status: 201 });
  } catch (e: any) {
    return Response.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
