import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "expense:review", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const expenses = Array.from(memoryStore.expenses.values()).filter((e: any) => e.organizationId === session.organizationId);
  const pending = expenses.filter((e: any) => e.reviewStatus === "SUBMITTED" || e.reviewStatus === "REVIEW_REQUIRED").length;
  const flagged = expenses.filter((e: any) => (e as any).flagged || (e as any).flaggedReason).length;

  return NextResponse.json({
    data: { queueSize: pending, flaggedCount: flagged, total: expenses.length },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "recent" as const, drillDown: { endpoint: "/api/v1/expenses", params: { reviewState: "SUBMITTED" } } },
  }, { headers: { "X-Request-Id": requestId } });
}
