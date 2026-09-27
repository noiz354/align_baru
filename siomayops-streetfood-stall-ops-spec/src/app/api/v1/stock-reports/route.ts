import { NextRequest } from "next/server";
import { stockReportRequestSchema } from "@/shared/contracts/inventory";
import { submitStockReport } from "@/features/inventory";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = stockReportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, "POST /api/v1/stock-reports", data, async () => {
      const res = await submitStockReport({
        shiftId: data.shiftId,
        kind: data.kind,
        items: data.items.map(i => ({ stockItemId: i.stockItemId, quantity: i.quantity, notCounted: i.notCounted, reason: i.reason })),
        clientReportId: data.clientReportId,
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
