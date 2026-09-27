import { NextRequest, NextResponse } from "next/server";
import { syncBatchRequestSchema } from "@/shared/contracts/sync";
import { applySyncBatch } from "@/features/offline";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";


export async function POST(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    const body = await request.json();
    const parsed = syncBatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_FAILED", "Invalid sync batch", 400, requestId, parsed.error.flatten());
    }
    const data = parsed.data;

    const result = await applySyncBatch({
      organizationId: session.organizationId,
      actorId: session.operatorId || session.userId,
      batch: { records: data.records.map(r => ({ ...r, payload: r.payload })) } as any,
    });

    return NextResponse.json({
      deviceId: data.deviceId,
      results: result.results,
      requestId,
    }, { status: 200, headers: { "X-Request-Id": requestId } });
  } catch (e: any) {
    return errorResponse(e.code || "INTERNAL", e.message, 500, requestId);
  }
}
