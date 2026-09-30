import { authorize } from "@/server/auth/port";
import { getIncidentReviewInbox } from "@/features/incidents";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export const dynamic = "force-dynamic";

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(): Promise<Response> {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return noStore(errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId));
  if (!session.roles.some((role) => ["OWNER", "HQ_OPS", "AREA_SUPERVISOR"].includes(role))) {
    return noStore(errorResponse("FORBIDDEN", "Incident review access is not allowed", 403, requestId));
  }
  try {
    authorize(session, "incident:view", session.scope);
    const inbox = getIncidentReviewInbox(session);
    return noStore(Response.json(inbox, { headers: { "X-Request-Id": requestId } }));
  } catch (error: any) {
    const status = error?.code === "FORBIDDEN" ? 403 : error?.status || 500;
    return noStore(errorResponse(error?.code || "INTERNAL", status === 403 ? "Incident review access is not allowed" : "Unable to load incident inbox", status, requestId));
  }
}
