import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { trackLocationEvent } from "@/features/locations/analytics";
import { locationCaptureEventSchema } from "@/shared/contracts/locations";
import { errorResponse, getRequestId, resolveSession } from "../../../../_helpers";

export async function POST(request: NextRequest): Promise<Response> {
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_FAILED", "Invalid JSON request", 400, requestId);
    }
    const parsed = locationCaptureEventSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid event", 400, requestId);
    }
    const { event, reason } = parsed.data;
    trackLocationEvent({
      eventName: event,
      requestId,
      reason,
    });
    return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403 : 500;
    return errorResponse(code, error?.message || "Unable to record location event", status, requestId);
  }
}
