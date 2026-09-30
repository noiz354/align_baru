import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { authorize } from "@/server/auth/port";
import { getDashboardReadModel } from "@/features/hq";

export async function GET(_request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "expense:review", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const readModel = await getDashboardReadModel(session);

  return NextResponse.json({
    data: {
      queueSize: readModel.expenses.pendingReviewCount,
      flaggedCount: readModel.expenses.flaggedCount,
      total: readModel.expenses.count,
      totalExpenses: { amountMinor: readModel.expenses.totalExpenses.amountMinor, currency: "IDR" },
      cashBoxExpenses: { amountMinor: readModel.expenses.cashBoxExpenses.amountMinor, currency: "IDR" },
      personalExpenses: { amountMinor: readModel.expenses.personalExpenses.amountMinor, currency: "IDR" },
      outlets: readModel.outlets,
      recentActivity: readModel.recentActivity,
    },
    meta: { computedAt: readModel.computedAt, freshnessBand: readModel.freshnessBand, drillDown: { endpoint: "/api/v1/expenses", params: { reviewState: "SUBMITTED" } } },
  }, { headers: { "X-Request-Id": requestId } });
}
