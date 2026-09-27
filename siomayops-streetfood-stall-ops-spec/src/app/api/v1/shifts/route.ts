import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "shift:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const businessDay = url.searchParams.get("businessDay");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  let shifts = Array.from(memoryStore.shifts.values()).filter(s => s.organizationId === session.organizationId);
  if (status) shifts = shifts.filter(s => s.status === status);
  if (businessDay) shifts = shifts.filter(s => s.businessDay === businessDay);
  // Scope filtering: self can only see own shifts
  if (session.scope.kind === "self") {
    shifts = shifts.filter(s => s.operatorId === session.scope.operatorId);
  }
  shifts = shifts.sort((a,b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit);

  return NextResponse.json({ data: shifts, pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}
