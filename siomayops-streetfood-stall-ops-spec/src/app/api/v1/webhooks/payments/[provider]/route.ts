import { NextRequest, NextResponse } from "next/server";
import { verifyProviderCallback } from "@/server/payments/webhook-verifier";
import { verifyPaymentViaCallback } from "@/features/payments";
import { errorResponse, getRequestId } from "../../../_helpers";

export async function POST(request: NextRequest, ctx: { params: Promise<{ provider: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const { provider } = await ctx.params;
    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const verification = verifyProviderCallback({
      providerId: provider,
      rawBody,
      headers,
    });

    if (verification.kind === "REJECTED") {
      return errorResponse(verification.reasonCode, `Callback rejected: ${verification.reasonCode}`, 400, requestId);
    }

    const cb = verification.callback;

    const result = await verifyPaymentViaCallback({
      provider: cb.providerId,
      providerReference: cb.providerReferenceId,
      signatureValid: true,
      rawPayload: rawBody,
      amountMinor: cb.amountMinor,
      organizationId: undefined, // will be resolved via payment lookup
    });

    return NextResponse.json({
      provider,
      providerReference: cb.providerReferenceId,
      status: result.status,
      paymentId: result.paymentId,
      requestId,
    }, { status: 200, headers: { "X-Request-Id": requestId } });
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
