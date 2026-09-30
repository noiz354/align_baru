import { authorize } from "@/server/auth/port";
import { getOperatorIncident } from "@/features/incidents";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ incidentId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR") || session.scope.kind !== "self") {
      return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    }
    authorize(session, "incident:view", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });
    const { incidentId } = await context.params;
    const incident = getOperatorIncident(session, incidentId);
    if (!incident) return errorResponse("NOT_FOUND", "Incident report not found", 404, requestId);
    return Response.json({ incident }, { headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", "X-Request-Id": requestId } });
  } catch (error: any) {
    const status = error?.code === "FORBIDDEN" ? 403 : 500;
    return errorResponse(error?.code || "INTERNAL", "Unable to load incident report", status, requestId);
  }
}
