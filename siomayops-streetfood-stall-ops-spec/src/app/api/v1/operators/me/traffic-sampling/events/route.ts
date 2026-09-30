/** PHASE 0 — Page 11 implementation remains production-gated pending privacy and purge evidence. */
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { trackTrafficSamplingEvent } from "@/features/traffic-sampling/analytics";
import { trafficSamplingEventSchema } from "@/shared/contracts/traffic-samples";
import { errorResponse, getRequestId, resolveSession } from "../../../../_helpers";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "traffic-sample:view", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });
    const parsed = trafficSamplingEventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("VALIDATION_FAILED", "Invalid analytics event", 400, requestId);
    trackTrafficSamplingEvent({ eventName: parsed.data.event, requestId, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) });
    return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    return errorResponse(code, error?.message || "Unable to record event", code === "FORBIDDEN" ? 403 : 500, requestId);
  }
}
