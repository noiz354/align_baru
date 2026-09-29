import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getDefaultDashboardDay, getHqOutletDetail, HqDashboardNotFoundError } from "@/features/hq/dashboard";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

export async function GET(request: NextRequest, context: { params: Promise<{ outletId: string }> }) {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
    const { outletId } = await context.params;
    const day = request.nextUrl.searchParams.get("date") ?? getDefaultDashboardDay();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T12:00:00Z`))) {
      return errorResponse("VALIDATION_ERROR", "Invalid business day", 400, requestId);
    }
    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) return errorResponse("VALIDATION_ERROR", "Limit must be between 1 and 100", 400, requestId);
    const detail = getHqOutletDetail({ scope: session.scope, businessDay: day, outletId, cursor: request.nextUrl.searchParams.get("cursor") || undefined, limit: rawLimit });
    return NextResponse.json({ data: detail, meta: { requestId } }, { headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return errorResponse("NOT_FOUND", error.message, 404, requestId);
    const status = (error as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return errorResponse(status === 403 ? "FORBIDDEN" : "INTERNAL", status === 403 ? "Dashboard access denied" : "Unable to load outlet detail", status, requestId);
  }
}
