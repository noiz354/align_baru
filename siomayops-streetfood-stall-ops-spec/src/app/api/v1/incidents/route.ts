import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { incidentSubmitRequestSchema } from "@/shared/contracts/incidents";
import { getOperatorIncident, getOperatorIncidentSubmissionContext, getOperatorIncidentsPage, submitIncident } from "@/features/incidents";
import { trackIncidentEvent } from "@/features/incidents/analytics";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../_helpers";

export const dynamic = "force-dynamic";

function selfTarget(session: NonNullable<Awaited<ReturnType<typeof resolveSession>>>) {
  return { kind: "self" as const, organizationId: session.organizationId, operatorId: session.operatorId! };
}

function operatorSessionAllowed(session: NonNullable<Awaited<ReturnType<typeof resolveSession>>>) {
  return Boolean(session.operatorId && session.roles.includes("OPERATOR") && session.scope.kind === "self" &&
    session.scope.organizationId === session.organizationId && session.scope.operatorId === session.operatorId);
}

export async function GET(): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!operatorSessionAllowed(session)) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "incident:view", selfTarget(session));
    const page = getOperatorIncidentsPage(session);
    trackIncidentEvent({ eventName: "incident_report_started", requestId, outcome: "SUCCESS" });
    return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = error?.status || (code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "PRECONDITION_FAILED" ? 412 : 500);
    return errorResponse(code, "Unable to load incident report context", status, requestId);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) {
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: "UNAUTHENTICATED" });
      return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    }
    if (!operatorSessionAllowed(session)) {
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: "FORBIDDEN" });
      return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    }
    authorize(session, "incident:submit", selfTarget(session));

    let body: unknown;
    try { body = await request.json(); }
    catch {
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Invalid JSON request", 400, requestId);
    }
    const parsed = incidentSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Invalid incident report", 400, requestId);
    }
    const data = parsed.data;
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey !== data.clientIncidentId) {
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Idempotency-Key must match clientIncidentId", 400, requestId);
    }

    const context = getOperatorIncidentSubmissionContext(session);
    const result = await handleWithIdempotency(
      request,
      `POST /api/v1/incidents/operator/${session.operatorId}`,
      data,
      async () => {
        const incident = await submitIncident({
          organizationId: session.organizationId,
          operatorId: session.operatorId,
          shiftId: context.shiftId as any,
          stallId: context.stallId as any,
          sellingLocationId: context.sellingLocationId as any,
          categoryCode: data.categoryCode,
          severityHint: data.severityHint,
          description: data.description,
          occurredAt: new Date(data.occurredAt),
          amountMinor: data.amountMinor,
          amountContext: data.amountContext,
          clientIncidentId: data.clientIncidentId,
        });
        const stored = getOperatorIncident(session, incident.incidentId);
        if (!stored) throw Object.assign(new Error("Saved incident is not available in reporter scope"), { code: "INTERNAL", status: 500 });
        trackIncidentEvent({ eventName: "incident_submitted", requestId, outcome: incident.replayed ? "REPLAYED" : "CREATED" });
        return { body: { incident: stored }, status: 201 };
      },
    );
    if (result.status >= 400) {
      const reason = result.status === 403 ? "FORBIDDEN"
        : result.status === 400 ? "VALIDATION"
        : result.status === 409 || result.status === 422 ? "CONFLICT"
        : "SERVER";
      trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason });
    } else if (result.headers.get("X-Idempotent-Replayed") === "true") {
      trackIncidentEvent({ eventName: "incident_submitted", requestId, outcome: "REPLAYED" });
    }
    return result;
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = error?.status || (code === "FORBIDDEN" ? 403 : code === "NOT_FOUND" ? 404 : code === "VALIDATION_FAILED" ? 400 : 500);
    trackIncidentEvent({ eventName: "incident_submit_failed", requestId, reason: status === 403 ? "FORBIDDEN" : status === 400 ? "VALIDATION" : "SERVER" });
    return errorResponse(code, status === 403 ? "Incident report scope is not allowed" : status === 400 ? "Invalid incident report" : "Unable to submit incident report", status, requestId);
  }
}
