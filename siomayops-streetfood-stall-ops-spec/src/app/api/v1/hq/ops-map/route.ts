import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { authorize } from "@/server/auth/port";
import { getOpsMapReadModel } from "@/features/hq/ops-map";

/** GET /api/v1/hq/ops-map — operations map read model (HQ_OPS / AREA_SUPERVISOR, `hq:view`). */
export async function GET(_request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
  } catch (e: any) {
    return errorResponse("FORBIDDEN", e.message, 403, requestId);
  }

  const result = await getOpsMapReadModel(session.organizationId);
  return NextResponse.json(result, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}
