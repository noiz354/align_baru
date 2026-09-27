import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const locations = Array.from(memoryStore.sellingLocations.values()).filter((l: any) => l.organizationId === session.organizationId);
  const today = new Date().toISOString().slice(0,10);
  const usedToday = locations.filter((l: any) => {
    return Array.from(memoryStore.locationReports.values()).some((r: any) => r.sellingLocationId === l.id);
  }).length;

  return NextResponse.json({
    data: { total: locations.length, usedToday, dormant: locations.length - usedToday, restricted: locations.filter((l: any) => l.status === "RESTRICTED").length },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "recent" as const, drillDown: { endpoint: "/api/v1/locations" } },
  }, { headers: { "X-Request-Id": requestId } });
}
