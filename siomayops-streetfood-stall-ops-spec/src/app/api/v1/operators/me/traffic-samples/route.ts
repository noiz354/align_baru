/** PHASE 0 — Page 11 implementation remains production-gated pending privacy and purge evidence. */
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { createTrafficSample } from "@/features/traffic-sampling";
import { trackTrafficSamplingEvent } from "@/features/traffic-sampling/analytics";
import { trafficSampleCreateSchema } from "@/shared/contracts/traffic-samples";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "traffic-sample:create", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });
    const parsed = trafficSampleCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("VALIDATION_FAILED", "Invalid traffic sample", 400, requestId);
    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    if (idempotencyKey !== parsed.data.clientRequestId) return errorResponse("VALIDATION_FAILED", "Idempotency-Key must match clientRequestId", 400, requestId);
    const result = await createTrafficSample({ scope: session.scope, requestId, ...parsed.data });
    if (!result.replayed) trackTrafficSamplingEvent({ eventName: "traffic_analysis_completed", requestId, outcome: "success" });
    const { replayed, ...sample } = result;
    return NextResponse.json({ sample }, { status: 201, headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...(replayed ? { "X-Idempotent-Replayed": "true" } : {}),
    } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403 : code === "FEATURE_DISABLED" ? 503 : code === "IDEMPOTENCY_MISMATCH" ? 422 : code === "VALIDATION_FAILED" ? 400 : code === "NOT_FOUND" ? 404 : code === "PRECONDITION_FAILED" ? 412 : 500;
    trackTrafficSamplingEvent({ eventName: "traffic_analysis_failed", requestId, outcome: "failure", reason: code === "FORBIDDEN" ? "forbidden" : code === "VALIDATION_FAILED" ? "validation" : "server" });
    return errorResponse(code, error?.message || "Unable to save traffic estimate", status, requestId);
  }
}
