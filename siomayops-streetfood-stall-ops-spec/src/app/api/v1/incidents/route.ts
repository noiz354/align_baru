import { NextRequest } from "next/server";
import { incidentSubmitRequestSchema } from "@/shared/contracts/incidents";
import { submitIncident } from "@/features/incidents";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../_helpers";

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = incidentSubmitRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/incidents", data, async () => {
      const res = await submitIncident({
        shiftId: data.shiftId,
        stallId: data.stallId,
        sellingLocationId: data.sellingLocationId,
        categoryId: data.categoryId,
        severity: data.severity as any,
        description: data.description,
        clientIncidentId: data.clientIncidentId,
        recordedAtDevice: data.recordedAtDevice ? new Date(data.recordedAtDevice) : undefined,
        organizationId: session.organizationId,
        operatorId: session.operatorId || session.userId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
