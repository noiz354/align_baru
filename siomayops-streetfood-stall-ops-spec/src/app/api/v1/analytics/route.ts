import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { logger } from "@/server/telemetry";
import { dashboardAnalyticsEventSchema } from "@/shared/contracts/analytics";
import { errorResponse, getRequestId, resolveSession } from "../_helpers";

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);

  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
    const parsed = dashboardAnalyticsEventSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Invalid analytics event", 400, requestId);

    // MOCK ONLY — ANALYTICS NOT CONNECTED TO REAL TELEMETRY
    logger.info("dashboard.analytics", {
      organizationId: session.organizationId,
      actorId: session.userId,
      correlationId: requestId,
      route: "/api/v1/analytics",
      eventName: parsed.data.event,
      page: parsed.data.page,
      businessDay: parsed.data.businessDay,
      status: parsed.data.status,
      outletId: parsed.data.outletId,
      hasSearch: parsed.data.hasSearch,
      outcome: parsed.data.outcome,
      errorCode: parsed.data.errorCode,
    });
    return NextResponse.json({ data: { accepted: true }, meta: { requestId } }, { status: 202, headers: { "X-Request-Id": requestId } });
  } catch (error) {
    const status = (error as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return errorResponse(status === 403 ? "FORBIDDEN" : "INTERNAL", status === 403 ? "Analytics access denied" : "Unable to record analytics event", status, requestId);
  }
}
