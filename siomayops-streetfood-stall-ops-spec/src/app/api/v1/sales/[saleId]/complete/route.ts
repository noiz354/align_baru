import { NextRequest } from "next/server";
import { cashPaymentRequestSchema } from "@/shared/contracts/payments";
import { completeSale } from "@/features/sales";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";


export async function POST(request: NextRequest, ctx: { params: Promise<{ saleId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const { saleId } = await ctx.params;
    // This endpoint completes sale after payment already created, or just marks completed
    const sale = await completeSale(saleId);
    return new Response(JSON.stringify({
      saleId: sale.saleId,
      status: sale.status,
      total: { amountMinor: sale.total.amountMinor, currency: "IDR" },
      version: sale.version,
    }), { status: 200, headers: { "X-Request-Id": requestId } });
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
