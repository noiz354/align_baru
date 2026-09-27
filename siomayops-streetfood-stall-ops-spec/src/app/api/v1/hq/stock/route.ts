import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const movements = Array.from(memoryStore.stockMovements.values()).filter((m: any) => m.organizationId === session.organizationId);
  const byKind = movements.reduce((acc: any, m: any) => { const k = m.movementType || m.kind; acc[k] = (acc[k] || 0) + m.quantity; return acc; }, {} as Record<string, number>);

  return NextResponse.json({
    data: { byKind, totalMovements: movements.length },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "recent" as const, drillDown: { endpoint: "/api/v1/stock/movements" } },
  }, { headers: { "X-Request-Id": requestId } });
}
