import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { trackLocationEvent } from "@/features/locations/analytics";
import { locationReportRequestSchema } from "@/shared/contracts/locations";
import { idempotencyKeySchema } from "@/shared/contracts/common";
import { reportLocation } from "@/features/locations";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export async function POST(request: NextRequest, ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    if (!session.operatorId) return errorResponse("FORBIDDEN", "Operator self scope is required", 403, requestId);
    authorize(session, "location:report", {
      kind: "self",
      organizationId: session.organizationId,
      operatorId: session.operatorId,
    });

    const { shiftId } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_FAILED", "Invalid JSON request", 400, requestId);
    }
    const parsed = locationReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      trackLocationEvent({ eventName: "location_save_failed", requestId, reason: "validation" });
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;
    const idempotencyKey = request.headers.get("Idempotency-Key") || "";
    if (!idempotencyKeySchema.safeParse(idempotencyKey).success || idempotencyKey !== data.clientReportId) {
      return errorResponse("VALIDATION_FAILED", "Idempotency-Key must match clientReportId", 400, requestId);
    }
    const gpsSample = data.gpsSample ? {
      ...data.gpsSample,
      capturedAt: new Date(data.gpsSample.capturedAt),
    } : undefined;

    return await handleWithIdempotency(
      request,
      `POST /api/v1/shifts/${shiftId}/location-reports`,
      data,
      async () => {
        try {
          const result = await reportLocation({
            shiftId,
            sellingLocationId: data.sellingLocationId,
            trigger: data.trigger,
            reasonForMove: data.reasonForMove,
            note: data.note,
            clientReportId: data.clientReportId,
            organizationId: session.organizationId,
            operatorId: session.operatorId!,
            gpsSample,
          });
          trackLocationEvent({
            eventName: "location_saved",
            requestId,
            gpsSampleIncluded: result.gpsSampleStored,
          });
          return { body: result, status: 201 };
        } catch (error: any) {
          const reason = error?.code === "FORBIDDEN" ? "forbidden"
            : error?.code === "CONFLICT" ? "conflict"
            : error?.code === "VALIDATION_FAILED" ? "validation"
            : "server";
          if (error && typeof error === "object" && !error.status) {
            error.status = error.code === "FORBIDDEN" ? 403
              : error.code === "NOT_FOUND" ? 404
              : error.code === "VALIDATION_FAILED" ? 400
              : error.code === "CONFLICT" ? 409
              : error.code === "PRECONDITION_FAILED" ? 412
              : 500;
          }
          trackLocationEvent({ eventName: "location_save_failed", requestId, reason });
          throw error;
        }
      },
    );
  } catch (error: any) {
    const code = error?.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403
      : code === "NOT_FOUND" ? 404
      : code === "VALIDATION_FAILED" ? 400
      : code === "CONFLICT" || code === "IDEMPOTENCY_MISMATCH" ? 409
      : code === "PRECONDITION_FAILED" ? 412
      : 500;
    return errorResponse(code, error?.message || "Unable to save location report", status, requestId);
  }
}
