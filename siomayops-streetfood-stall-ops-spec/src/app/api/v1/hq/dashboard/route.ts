import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { getDashboardReadModel } from "@/features/hq";

export async function GET(_request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) {
    return errorResponse("UNAUTHENTICATED", "Sesi tidak terautentikasi", 401, requestId);
  }
  try {
    const readModel = await getDashboardReadModel(session);
    return NextResponse.json(
      {
        data: readModel,
        meta: {
          computedAt: readModel.computedAt,
          freshnessBand: readModel.freshnessBand,
          requestId,
        },
      },
      { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const code = e.code || "INTERNAL";
    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHENTICATED" ? 401 : 500;
    return errorResponse(code, e.message || "Gagal memuat dashboard", status, requestId);
  }
}
