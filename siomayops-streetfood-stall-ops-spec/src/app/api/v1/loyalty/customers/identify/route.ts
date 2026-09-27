import { NextRequest } from "next/server";
import { loyaltyIdentifyRequestSchema } from "@/shared/contracts/loyalty";
import { identifyCustomer } from "@/features/loyalty";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = loyaltyIdentifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/loyalty/customers/identify", data, async () => {
      const res = await identifyCustomer({
        method: data.method as any,
        value: data.value,
        consentGiven: data.consentGiven,
        consentTextVersion: data.consentTextVersion,
        organizationId: session.organizationId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, e.code === "PRECONDITION_FAILED" ? 412 : 500, requestId);
  }
}
