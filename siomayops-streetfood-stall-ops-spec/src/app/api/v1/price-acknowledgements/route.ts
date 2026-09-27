import { NextRequest } from "next/server";
import { priceAcknowledgementRequestSchema } from "@/shared/contracts/pricing";
import { acknowledgePriceSet } from "@/features/pricing";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = priceAcknowledgementRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/price-acknowledgements", data, async () => {
      const res = await acknowledgePriceSet({
        operatorId: session.operatorId || session.userId,
        priceSetDigest: data.priceSetDigest,
        organizationId: session.organizationId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
