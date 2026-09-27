import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "config:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  return NextResponse.json({
    data: {
      cashToleranceMinor: 10000,
      varianceFlagMinor: 50000,
      incidentSlaMinutes: { HIGH: 60, MEDIUM: 240, LOW: 1440 },
      expenseFlag: { highAmountMinor: 200000, repeatedUnverifiedThreshold: 3 },
      pricing: { operatorAllowedPercent: 10, maxDailyOverrides: 5 },
    },
    meta: { computedAt: new Date().toISOString() },
  }, { headers: { "X-Request-Id": requestId } });
}
