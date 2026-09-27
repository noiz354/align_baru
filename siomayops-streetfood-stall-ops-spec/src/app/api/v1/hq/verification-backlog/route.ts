import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "payment:reconcile", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const pending = Array.from(memoryStore.payments.values()).filter(p => p.organizationId === session.organizationId && p.status === "PENDING_VERIFICATION");
  const totalMinor = pending.reduce((s, p) => s + p.amountMinor, 0);
  const oldest = pending.length ? pending.reduce((old, p) => p.createdAt < old ? p.createdAt : old, pending[0]!.createdAt) : null;

  return NextResponse.json({
    data: {
      pendingCount: pending.length,
      unverifiedAmount: { amountMinor: totalMinor, currency: "IDR" },
      oldestAgeMinutes: oldest ? Math.floor((Date.now() - oldest.getTime()) / 60000) : 0,
      oldestPaymentId: pending.length ? pending.sort((a,b)=>a.createdAt.getTime()-b.createdAt.getTime())[0]!.id : null,
    },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "current" as const, drillDown: { endpoint: "/api/v1/payments", params: { status: "PENDING_VERIFICATION" } } },
  }, { headers: { "X-Request-Id": requestId } });
}
