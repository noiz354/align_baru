/** PHASE 0 — Page 11 implementation remains production-gated pending privacy and purge evidence. */
import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { uploadTrafficVideo } from "@/features/traffic-sampling";
import { trackTrafficSamplingEvent } from "@/features/traffic-sampling/analytics";
import { trafficVideoUploadMetadataSchema, TRAFFIC_VIDEO_MAX_BYTES } from "@/shared/contracts/traffic-samples";
import { errorResponse, getRequestId, resolveSession } from "../../../../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId || !session.roles.includes("OPERATOR")) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "traffic-sample:create", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });
    authorize(session, "evidence:upload", { kind: "self", organizationId: session.organizationId, operatorId: session.operatorId });

    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      return errorResponse("VALIDATION_FAILED", "A UUID Idempotency-Key is required", 400, requestId);
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > TRAFFIC_VIDEO_MAX_BYTES + 64 * 1024) {
      return errorResponse("PAYLOAD_TOO_LARGE", "Video exceeds the 10 MB upload limit", 413, requestId);
    }
    const form = await request.formData();
    const file = form.get("video");
    const metadata = trafficVideoUploadMetadataSchema.safeParse({ durationMs: form.get("durationMs") });
    if (!(file instanceof File) || !metadata.success) {
      return errorResponse("VALIDATION_FAILED", "Video file and duration are required", 400, requestId);
    }
    if (file.type !== "video/webm" || file.size < 8 || file.size > TRAFFIC_VIDEO_MAX_BYTES) {
      return errorResponse("VALIDATION_FAILED", "Only WebM clips up to 10 MB are accepted", 400, requestId);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadTrafficVideo({ scope: session.scope, bytes, durationMs: metadata.data.durationMs, contentType: file.type, clientRequestId: idempotencyKey });
    if (!result.replayed) trackTrafficSamplingEvent({ eventName: "traffic_sample_uploaded", requestId, outcome: "success", mediaBytes: file.size, durationMs: metadata.data.durationMs });
    const { replayed, ...upload } = result;
    return NextResponse.json(upload, { status: 201, headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...(replayed ? { "X-Idempotent-Replayed": "true" } : {}),
    } });
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403 : code === "FEATURE_DISABLED" ? 503 : code === "IDEMPOTENCY_MISMATCH" ? 422 : code === "NOT_FOUND" ? 404 : code === "PRECONDITION_FAILED" ? 412 : code === "VALIDATION_FAILED" ? 400 : 500;
    trackTrafficSamplingEvent({ eventName: "traffic_analysis_failed", requestId, outcome: "failure", reason: code === "FORBIDDEN" ? "forbidden" : code === "VALIDATION_FAILED" ? "validation" : "server" });
    return errorResponse(code, error?.message || "Unable to upload traffic video", status, requestId);
  }
}
