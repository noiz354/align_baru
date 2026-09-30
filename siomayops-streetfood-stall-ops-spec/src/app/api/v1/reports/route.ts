import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getOperationalReport, HqDashboardNotFoundError, ReportDatasetTooLargeError, ReportQueryError, trackReportEvent } from "@/features/reports";
import { reportReadQuerySchema } from "@/shared/contracts/reports";
import { errorResponse, getRequestId, resolveSession } from "../_helpers";

function filterKinds(query: { dateFrom?: string; dateTo?: string; areaId?: string; outletId?: string }): ("dateRange" | "area" | "outlet")[] {
  return [
    ...(query.dateFrom || query.dateTo ? ["dateRange" as const] : []),
    ...(query.areaId ? ["area" as const] : []),
    ...(query.outletId ? ["outlet" as const] : []),
  ];
}

function rangeDays(dateFrom: string, dateTo: string): number {
  const [fy, fm, fd] = dateFrom.split("-").map(Number);
  const [ty, tm, td] = dateTo.split("-").map(Number);
  return Math.floor((Date.UTC(ty!, tm! - 1, td!, 12) - Date.UTC(fy!, fm! - 1, fd!, 12)) / 86_400_000) + 1;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
  try {
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Report access denied", 403, requestId);
  }

  const parsed = reportReadQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Filter laporan tidak valid", 400, requestId, parsed.error.flatten());
  try {
    const report = getOperationalReport({ scope: session.scope, ...parsed.data });
    const filters = filterKinds(parsed.data);
    const days = rangeDays(report.filters.dateFrom, report.filters.dateTo);
    const analytics = { requestId, rangeDays: days, ...(filters.length ? { filters } : {}) };
    // Every successful request is a view; filtered requests also record only filter categories.
    trackReportEvent("report_viewed", analytics);
    if (filters.length) trackReportEvent("report_filter_changed", analytics);
    return NextResponse.json({ data: report, meta: { requestId } }, {
      headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return errorResponse("NOT_FOUND", "Outlet atau area tidak ditemukan", 404, requestId);
    if (error instanceof ReportQueryError) return errorResponse("VALIDATION_ERROR", error.message, 400, requestId);
    if (error instanceof ReportDatasetTooLargeError) return errorResponse("REPORT_TOO_LARGE", error.message, 413, requestId);
    return errorResponse("INTERNAL", "Laporan tidak dapat dimuat", 500, requestId);
  }
}
