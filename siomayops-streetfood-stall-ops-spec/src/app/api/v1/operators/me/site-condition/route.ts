import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getSiteConditionPage, createSiteConditionObservation } from "@/features/site-condition";
import { trackSiteConditionEvent } from "@/features/site-condition/analytics";
import { siteConditionObservationRequestSchema } from "@/shared/contracts/site-condition";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export const dynamic = "force-dynamic";
const selfTarget = (session: NonNullable<Awaited<ReturnType<typeof resolveSession>>>) => ({
  kind: "self" as const,
  organizationId: session.organizationId,
  operatorId: session.operatorId!,
});

function statusFor(code: string): number {
  if (code === "FORBIDDEN") return 403;
  if (code === "NOT_FOUND") return 404;
  if (code === "PRECONDITION_FAILED") return 412;
  if (code === "IDEMPOTENCY_MISMATCH" || code === "CONFLICT") return 409;
  if (code === "VALIDATION_FAILED") return 400;
  return 500;
}

export async function GET(): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) {
      return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    }
    authorize(session, "site-condition:view", selfTarget(session));
    const result = await getSiteConditionPage(session);
    trackSiteConditionEvent({ eventName: "site_condition_viewed", requestId, outcome: "SUCCESS" });
    if (result.assessment.cue === "REVIEW_SHELTER") {
      trackSiteConditionEvent({
        eventName: "relocation_recommendation_viewed",
        requestId,
        cue: result.assessment.cue,
      });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" },
    });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = statusFor(code);
    return errorResponse(code, error?.message || "Unable to load site conditions", status, requestId);
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) {
      return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    }
    authorize(session, "site-condition:create", selfTarget(session));

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      trackSiteConditionEvent({ eventName: "site_observation_save_failed", requestId, outcome: "FAILURE", reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Invalid JSON request", 400, requestId);
    }
    const parsed = siteConditionObservationRequestSchema.safeParse(body);
    if (!parsed.success) {
      trackSiteConditionEvent({ eventName: "site_observation_save_failed", requestId, outcome: "FAILURE", reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Invalid site observation", 400, requestId);
    }
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey !== parsed.data.clientRequestId) {
      trackSiteConditionEvent({ eventName: "site_observation_save_failed", requestId, outcome: "FAILURE", reason: "VALIDATION" });
      return errorResponse("VALIDATION_FAILED", "Idempotency-Key must match clientRequestId", 400, requestId);
    }

    const result = await createSiteConditionObservation({ session, request: parsed.data, requestId });
    trackSiteConditionEvent({
      eventName: "site_observation_saved",
      requestId,
      outcome: result.replayed ? "REPLAYED" : "CREATED",
    });
    const { replayed, observation } = result;
    return NextResponse.json({ observation }, {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        ...(replayed ? { "X-Idempotent-Replayed": "true" } : {}),
      },
    });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const reason = code === "FORBIDDEN" ? "FORBIDDEN"
      : code === "PRECONDITION_FAILED" ? "NO_ACTIVE_SHIFT"
      : code === "CONFLICT" || code === "IDEMPOTENCY_MISMATCH" ? "CONFLICT"
      : code === "VALIDATION_FAILED" ? "VALIDATION"
      : "SERVER";
    trackSiteConditionEvent({ eventName: "site_observation_save_failed", requestId, outcome: "FAILURE", reason });
    return errorResponse(code, error?.message || "Unable to save site observation", statusFor(code), requestId);
  }
}
