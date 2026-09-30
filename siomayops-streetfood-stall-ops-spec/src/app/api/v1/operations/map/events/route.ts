import { NextRequest, NextResponse } from "next/server";
import { trackOperationsMapEvent } from "@/features/hq";
import { authorize } from "@/server/auth/port";
import { mapMarkerEventSchema } from "@/shared/contracts/operations-map";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Map access denied", 403, requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Event body must be valid JSON", 400, requestId);
  }
  const parsed = mapMarkerEventSchema.safeParse(body);
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Map event is not allowed", 400, requestId, parsed.error.flatten());

  trackOperationsMapEvent(parsed.data.event, { requestId, markerType: parsed.data.markerType });
  return NextResponse.json({ data: { accepted: true }, meta: { requestId } }, {
    status: 202,
    headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
  });
}
