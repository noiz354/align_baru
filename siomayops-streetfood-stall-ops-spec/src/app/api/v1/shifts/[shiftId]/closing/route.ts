import { NextRequest } from "next/server";
import { submitClosingRequestSchema } from "@/shared/contracts/shifts";
import { submitShiftClosing } from "@/features/shifts";
import { money } from "@/shared/money/money";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../../_helpers";


export async function POST(request: NextRequest, ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const { shiftId } = await ctx.params;
    const body = await request.json();
    const parsed = submitClosingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, `POST /api/v1/shifts/${shiftId}/closing`, data, async () => {
      const res = await submitShiftClosing({
        shiftId,
        countedCash: money(data.countedCash.amountMinor, "IDR"),
        varianceReason: data.varianceReason,
        varianceNote: data.varianceNote,
        stockCounts: data.stockCounts.map(sc => ({
          stockItemId: sc.stockItemId,
          countedQuantity: sc.countedQuantity,
          reason: sc.reason,
        })),
        clientClosingId: data.clientClosingId,
        organizationId: session.organizationId,
      });
      return { body: res, status: 201 };
    });
    return result;
  } catch (e: any) {
    const status = e.code === "INVALID_TRANSITION" ? 409 : e.code === "NOT_FOUND" ? 404 : 500;
    return errorResponse(e.code || "INTERNAL", e.message, status, requestId);
  }
}
