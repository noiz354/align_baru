import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const closings = Array.from((memoryStore.closings as any).values()).filter((c: any) => c.organizationId === session.organizationId);
  const totalVariance = closings.reduce((sum: number, c: any) => sum + (c.varianceMinor || 0), 0);
  const unresolved = Array.from(memoryStore.payments.values()).filter(p => p.organizationId === session.organizationId && p.status === "PENDING_VERIFICATION").length;

  return NextResponse.json({
    data: {
      totalVariance: { amountMinor: totalVariance, currency: "IDR" },
      unresolvedVerifications: unresolved,
      closingsCount: closings.length,
    },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "recent" as const, drillDown: { endpoint: "/api/v1/closings" } },
  }, { headers: { "X-Request-Id": requestId } });
}
