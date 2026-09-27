import { NextRequest } from "next/server";
import { rewardRedeemRequestSchema } from "@/shared/contracts/loyalty";
import { redeemReward } from "@/features/loyalty";
import { handleWithIdempotency, errorResponse, getRequestId, resolveSession } from "../../../../_helpers";


export async function POST(request: NextRequest, ctx: { params: Promise<{ rewardInstanceId: string }> }): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const { rewardInstanceId } = await ctx.params;
    const body = await request.json();
    const parsed = rewardRedeemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid request", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await handleWithIdempotency(request, `POST /api/v1/loyalty/rewards/${rewardInstanceId}/redeem`, data, async () => {
      const res = await redeemReward({
        rewardInstanceId,
        saleId: data.saleId,
        clientRedeemId: data.clientRedeemId || rewardInstanceId,
        organizationId: session.organizationId,
      });
      return { body: res, status: res.outcome === "REDEEMED" ? 200 : 409 };
    });
    return result;
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
