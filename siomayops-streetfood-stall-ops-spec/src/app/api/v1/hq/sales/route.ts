import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { authorize } from "@/server/auth/port";
import { getDashboardReadModel } from "@/features/hq";

export async function GET(_request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const readModel = await getDashboardReadModel(session);

  return NextResponse.json({
    data: {
      grossByMethod: {
        CASH: { amountMinor: readModel.sales.grossByMethod.CASH.amountMinor, currency: "IDR" },
        DIGITAL_VERIFIED: { amountMinor: readModel.sales.grossByMethod.DIGITAL_VERIFIED.amountMinor, currency: "IDR" },
        DIGITAL_UNVERIFIED: { amountMinor: readModel.sales.grossByMethod.DIGITAL_UNVERIFIED.amountMinor, currency: "IDR" },
      },
      totalSales: readModel.sales.count,
      totalSalesAmount: { amountMinor: readModel.sales.totalSales.amountMinor, currency: "IDR" },
      outlets: readModel.outlets,
      recentActivity: readModel.recentActivity,
    },
    meta: { computedAt: readModel.computedAt, freshnessBand: readModel.freshnessBand, drillDown: { endpoint: "/api/v1/sales" } },
  }, { headers: { "X-Request-Id": requestId } });
}
