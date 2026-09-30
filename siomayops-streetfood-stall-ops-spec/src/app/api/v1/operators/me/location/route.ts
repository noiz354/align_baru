import { NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getOperatorLocationContext } from "@/features/locations";
import { trackLocationEvent } from "@/features/locations/analytics";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export async function GET(): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "location:view", {
      kind: "self",
      organizationId: session.organizationId,
      operatorId: session.operatorId,
    });
    const context = getOperatorLocationContext(session.scope);
    trackLocationEvent({ eventName: "location_page_viewed", requestId });
    return NextResponse.json(context, {
      headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
    });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403
      : code === "NOT_FOUND" ? 404
      : code === "CONFLICT" ? 409
      : code === "PRECONDITION_FAILED" ? 412
      : 500;
    return errorResponse(code, error?.message || "Unable to load location context", status, requestId);
  }
}
