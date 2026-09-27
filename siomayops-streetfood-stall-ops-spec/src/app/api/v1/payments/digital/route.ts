import { NextRequest } from "next/server";
import { digitalPaymentRequestSchema } from "@/shared/contracts/payments";
import { createDigitalPayment } from "@/features/payments";
import { money } from "@/shared/money/money";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = digitalPaymentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/payments/digital", data, async () => {
      const res = await createDigitalPayment({
        saleId: data.saleId,
        method: data.method,
        amount: money(data.amount.amountMinor, "IDR"),
        clientPaymentId: data.clientPaymentId,
        operatorNote: data.operatorNote,
        organizationId: session.organizationId,
      });
      return {
        body: {
          paymentId: res.paymentId,
          status: res.status,
          providerReference: res.providerReference,
        },
        status: 201,
      };
    });
    return result;
  } catch (e: any) {
    const status = e.code === "CONFLICT" ? 409 : e.code === "VALIDATION_FAILED" ? 400 : e.code === "NOT_FOUND" ? 404 : 500;
    return errorResponse(e.code || "INTERNAL", e.message, status, requestId);
  }
}
