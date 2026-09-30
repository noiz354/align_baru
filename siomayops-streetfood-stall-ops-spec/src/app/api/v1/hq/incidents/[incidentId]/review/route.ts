import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { reviewIncident } from "@/features/incidents";
import { trackIncidentEvent } from "@/features/incidents/analytics";
import { incidentReviewRequestSchema } from "@/shared/contracts/incident-review";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../../../../_helpers";

export const dynamic = "force-dynamic";

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function POST(request: NextRequest, context: { params: Promise<{ incidentId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) {
      trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason: "UNAUTHENTICATED" });
      return noStore(errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId));
    }
    authorize(session, "incident:resolve", session.scope);
    let body: unknown;
    try { body = await request.json(); }
    catch {
      trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason: "VALIDATION" });
      return noStore(errorResponse("VALIDATION_FAILED", "Invalid JSON request", 400, requestId));
    }
    const parsed = incidentReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason: "VALIDATION" });
      return noStore(errorResponse("VALIDATION_FAILED", "Invalid incident review", 400, requestId));
    }
    const data = parsed.data;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey !== data.clientReviewId) {
      trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason: "VALIDATION" });
      return noStore(errorResponse("VALIDATION_FAILED", "Idempotency-Key must match clientReviewId", 400, requestId));
    }
    const { incidentId } = await context.params;
    const result = await handleWithIdempotency(
      request,
      `POST /api/v1/hq/incidents/${incidentId}/review/${session.userId}`,
      data,
      async () => {
        const review = await reviewIncident({
          session,
          incidentId,
          toStatus: data.status,
          note: data.note,
          correlationId: requestId,
        });
        if (data.status) {
          trackIncidentEvent({ eventName: "incident_status_changed", page: "hq-incident-review", requestId, outcome: "UPDATED", fromStatus: review.fromStatus, toStatus: review.status });
        }
        return { body: { review }, status: 200 };
      },
    );
    if (result.status >= 400) {
      const reason = result.status === 403 ? "FORBIDDEN"
        : result.status === 404 ? "NOT_FOUND"
        : result.status === 400 ? "VALIDATION"
        : result.status === 409 || result.status === 422 ? "CONFLICT"
        : "SERVER";
      trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason });
    } else {
      const replayed = result.headers.get("X-Idempotent-Replayed") === "true";
      if (data.note) {
        trackIncidentEvent({ eventName: "incident_review_note_added", page: "hq-incident-review", requestId, outcome: replayed ? "REPLAYED" : "CREATED" });
      }
      if (data.status && replayed) {
        trackIncidentEvent({ eventName: "incident_status_changed", page: "hq-incident-review", requestId, outcome: "REPLAYED", toStatus: data.status });
      }
    }
    return noStore(result);
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = error?.status || (code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "VALIDATION_FAILED" ? 400 : 500);
    const reason = status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 400 ? "VALIDATION" : status === 409 ? "CONFLICT" : "SERVER";
    trackIncidentEvent({ eventName: "incident_review_failed", page: "hq-incident-review", requestId, reason });
    return noStore(errorResponse(code, status === 403 ? "Incident review access is not allowed" : status === 404 ? "Incident not found" : status === 400 ? "Invalid incident review" : "Unable to update incident review", status, requestId));
  }
}
