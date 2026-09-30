/** PHASE 0 — Page 11 implementation remains production-gated pending privacy and purge evidence. */
import { NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getTrafficSamplingPage } from "@/features/traffic-sampling";
import { trackTrafficSamplingEvent } from "@/features/traffic-sampling/analytics";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) {
      return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    }
    authorize(session, "traffic-sample:view", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });
    const result = await getTrafficSamplingPage(session.scope);
    trackTrafficSamplingEvent({ eventName: "traffic_sampling_page_viewed", requestId });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "PRECONDITION_FAILED" ? 412 : 500;
    return errorResponse(code, error?.message || "Unable to load traffic sampling", status, requestId);
  }
}
