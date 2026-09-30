import { NextRequest, NextResponse } from "next/server";
import { getOperationsMap, HqDashboardNotFoundError, OperationsMapQueryError, trackOperationsMapEvent } from "@/features/hq";
import { authorize } from "@/server/auth/port";
import { operationsMapQuerySchema } from "@/shared/contracts/operations-map";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Map access denied", 403, requestId);
  }

  const parsed = operationsMapQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Filter peta tidak valid", 400, requestId, parsed.error.flatten());

  try {
    const map = getOperationsMap({ scope: session.scope, ...parsed.data });
    const filters = [
      ...(parsed.data.businessDay ? ["businessDay" as const] : []),
      ...(parsed.data.areaId ? ["area" as const] : []),
    ];
    trackOperationsMapEvent("map_viewed", { requestId, ...(filters.length ? { filters } : {}) });
    if (filters.length) trackOperationsMapEvent("map_filter_changed", { requestId, filters });
    if (map.summary.staleLocationCount > 0) {
      trackOperationsMapEvent("stale_location_seen", { requestId, staleLocationCount: map.summary.staleLocationCount });
    }
    return NextResponse.json({ data: map, meta: { requestId } }, {
      headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return errorResponse("NOT_FOUND", "Area tidak ditemukan", 404, requestId);
    if (error instanceof OperationsMapQueryError) return errorResponse("VALIDATION_ERROR", error.message, 400, requestId);
    return errorResponse("INTERNAL", "Peta operasional tidak dapat dimuat", 500, requestId);
  }
}
