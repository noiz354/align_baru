import { NextRequest } from "next/server";
import { restockRequestSchema } from "@/shared/contracts/inventory";
import { requestRestock } from "@/features/inventory";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = restockRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/restock-requests", data, async () => {
      const res = await requestRestock({
        stallId: data.stallId,
        items: data.items,
        neededBy: data.neededBy ? new Date(data.neededBy) : undefined,
        note: data.note,
        clientRequestId: data.clientRequestId,
        organizationId: session.organizationId,
        actorId: session.operatorId || session.userId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
