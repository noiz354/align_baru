import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const shifts = Array.from(memoryStore.shifts.values()).filter(s => s.organizationId === session.organizationId && s.status === "OPEN");
  return NextResponse.json({
    data: { unfinishedClosings: shifts.length, shifts: shifts.map(s => ({ shiftId: s.id, operatorId: s.operatorId, businessDay: s.businessDay, startedAt: s.startedAt })) },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "recent" as const, drillDown: { endpoint: "/api/v1/shifts", params: { status: "OPEN" } } },
  }, { headers: { "X-Request-Id": requestId } });
}
