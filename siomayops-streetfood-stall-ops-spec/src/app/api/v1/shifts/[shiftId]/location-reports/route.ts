import { NextRequest, NextResponse } from "next/server";
import { locationReportRequestSchema } from "@/shared/contracts/locations";
import { reportLocation } from "@/features/locations";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../../_helpers";


export async function POST(request: NextRequest, ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const { shiftId } = await ctx.params;
    const body = await request.json();
    const parsed = locationReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, `POST /api/v1/shifts/${shiftId}/location-reports`, data, async () => {
      const res = await reportLocation({
        shiftId,
        sellingLocationId: data.sellingLocationId,
        trigger: data.trigger as any,
        reasonForMove: data.reasonForMove as any,
        note: data.note,
        clientReportId: data.clientReportId,
        organizationId: session.organizationId,
        operatorId: session.operatorId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    const status = e.code === "CONFLICT" ? 409 : e.code === "PRECONDITION_FAILED" ? 412 : e.code === "NOT_FOUND" ? 404 : 500;
    return errorResponse(e.code || "INTERNAL", e.message, status, requestId);
  }
}
