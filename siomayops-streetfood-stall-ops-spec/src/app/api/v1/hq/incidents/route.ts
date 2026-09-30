import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const incidents = Array.from(memoryStore.incidents.values()).filter((i: any) => i.organizationId === session.organizationId);
  const byCategory = incidents.reduce((acc: any, inc: any) => { acc[inc.category] = (acc[inc.category] || 0) + 1; return acc; }, {} as Record<string, number>);
  const byStatus = incidents.reduce((acc: any, inc: any) => { acc[inc.status] = (acc[inc.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return NextResponse.json({
    data: { total: incidents.length, byCategory, byStatus },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "current" as const, drillDown: { endpoint: "/api/v1/hq/incidents/inbox" } },
  }, { headers: { "X-Request-Id": requestId } });
}
