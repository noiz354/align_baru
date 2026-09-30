import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { writeAuditEvent } from "@/features/audit";
import { generateId } from "@/server/db/memory-store";
import { getOperationalReport, HqDashboardNotFoundError, MAX_REPORT_OUTLETS, ReportDatasetTooLargeError, ReportQueryError, trackReportEvent } from "@/features/reports";
import { reportExportQuerySchema } from "@/shared/contracts/reports";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";

const csvCell = (value: string | number | null): string => {
  let cell = value === null ? "" : String(value);
  // String values from source data are untrusted; numeric values are typed report aggregates.
  if (typeof value === "string" && /^[\u0000-\u0020\uFEFF]*[=+@\-]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
};

function statusFor(error: unknown): number {
  const suppliedStatus = (error as { status?: unknown } | null)?.status;
  if (suppliedStatus === 401 || suppliedStatus === 403) return suppliedStatus;
  if (error instanceof HqDashboardNotFoundError) return 404;
  if (error instanceof ReportQueryError) return 400;
  if (error instanceof ReportDatasetTooLargeError) return 413;
  if ((error as { code?: string } | null)?.code === "FORBIDDEN") return 403;
  return 500;
}

function errorFor(error: unknown, requestId: string) {
  const status = statusFor(error);
  const code = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 400 ? "VALIDATION_ERROR" : status === 413 ? "REPORT_TOO_LARGE" : "INTERNAL";
  const message = status === 400 || status === 413
    ? (error instanceof Error ? error.message : "Laporan tidak dapat diekspor")
    : status === 401 ? "Sign in is required" : status === 403 ? "Export access denied" : status === 404 ? "Outlet atau area tidak ditemukan" : "Laporan tidak dapat diekspor";
  return errorResponse(code, message, status, requestId);
}

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  let eventRangeDays: number | undefined;
  const fail = (error: unknown) => {
    const status = statusFor(error);
    trackReportEvent("report_export_failed", { requestId, status: String(status), ...(eventRangeDays ? { rangeDays: eventRangeDays } : {}) });
    return errorFor(error, requestId);
  };

  const session = await resolveSession();
  if (!session) return fail(Object.assign(new Error("Sign in is required"), { status: 401 }));
  try {
    authorize(session, "hq:export", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return fail(error);
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  trackReportEvent("report_export_requested", { requestId, filters: [
    ...(query.dateFrom || query.dateTo ? ["dateRange" as const] : []),
    ...(query.areaId ? ["area" as const] : []),
    ...(query.outletId ? ["outlet" as const] : []),
  ] });
  const parsed = reportExportQuerySchema.safeParse(query);
  if (!parsed.success) return fail(new ReportQueryError("Filter laporan tidak valid"));

  try {
    const report = getOperationalReport({ scope: session.scope, ...parsed.data, limit: MAX_REPORT_OUTLETS });
    eventRangeDays = report.series.length;
    if (report.pagination.nextCursor) return fail(new ReportDatasetTooLargeError());

    const header = [
      "record_type", "date_from", "date_to", "business_day", "outlet_id", "outlet_name", "area_id",
      "sales_idr", "completed_transactions", "average_transaction_idr", "cash_paid_idr", "digital_verified_idr",
      "digital_unverified_idr", "reported_expenses_idr", "sales_after_expenses_idr", "incident_count",
      "incident_location_basis", "generated_at", "source_watermark",
    ];
    const lines = [header.map(csvCell).join(",")];
    const blank = { businessDay: null as string | null, outletId: null as string | null, outletName: null as string | null, areaId: null as string | null };
    const pushRow = (type: string, value: {
      businessDay?: string | null; outletId?: string | null; outletName?: string | null; areaId?: string | null;
      salesMinor?: number; completedTransactions?: number; averageTransactionMinor?: number; cashPaidMinor?: number;
      digitalVerifiedMinor?: number; digitalUnverifiedMinor?: number; reportedExpensesMinor?: number;
      salesAfterExpensesMinor?: number; incidentCount?: number;
    }) => {
      const row = [
        type, report.filters.dateFrom, report.filters.dateTo,
        value.businessDay ?? blank.businessDay, value.outletId ?? blank.outletId, value.outletName ?? blank.outletName, value.areaId ?? blank.areaId,
        value.salesMinor ?? 0, value.completedTransactions ?? 0, value.averageTransactionMinor ?? 0,
        value.cashPaidMinor ?? 0, value.digitalVerifiedMinor ?? 0, value.digitalUnverifiedMinor ?? 0,
        value.reportedExpensesMinor ?? 0, value.salesAfterExpensesMinor ?? 0, value.incidentCount ?? 0,
        report.incidents.locationBasis, report.generatedAt, report.sourceWatermark,
      ];
      lines.push(row.map(csvCell).join(","));
    };
    pushRow("SUMMARY", { ...report.summary, averageTransactionMinor: report.summary.averageTransactionMinor });
    for (const point of report.series) pushRow("DAILY", point);
    for (const outlet of report.outlets) pushRow("OUTLET", {
      outletId: outlet.id,
      outletName: outlet.name,
      areaId: outlet.areaId,
      salesMinor: outlet.salesMinor,
      completedTransactions: outlet.completedTransactions,
      averageTransactionMinor: outlet.averageTransactionMinor,
      cashPaidMinor: outlet.cashPaidMinor,
      digitalVerifiedMinor: outlet.digitalVerifiedMinor,
      digitalUnverifiedMinor: outlet.digitalUnverifiedMinor,
      reportedExpensesMinor: outlet.reportedExpensesMinor,
      salesAfterExpensesMinor: outlet.salesAfterExpensesMinor,
      incidentCount: outlet.incidentCount,
    });

    const exportId = generateId();
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: "HQ_USER",
      actorId: session.userId,
      actorRole: session.roles.join(","),
      action: "export.created",
      subjectKind: "operational_report_export",
      subjectId: exportId,
      correlationId: requestId,
      occurredAt: new Date(),
      afterSummary: {
        dateFrom: report.filters.dateFrom,
        dateTo: report.filters.dateTo,
        areaId: report.filters.areaId,
        outletId: report.filters.outletId,
        outletRows: report.outlets.length,
        dailyRows: report.series.length,
        generatedAt: report.generatedAt,
        sourceWatermark: report.sourceWatermark,
      },
    });
    const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
    const eventRows = report.outlets.length + report.series.length + 1;
    trackReportEvent("report_export_succeeded", { requestId, status: "200", rangeDays: report.series.length, rowCount: eventRows });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="siomayops-report-${report.filters.dateFrom}-${report.filters.dateTo}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
