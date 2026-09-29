import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { memoryStore, generateId } from "@/server/db/memory-store";
import { writeAuditEvent } from "@/features/audit";
import { authorizeHqScope, getDefaultDashboardDay, getHqDashboard, HqDashboardNotFoundError } from "@/features/hq/dashboard";
import { errorResponse, getRequestId, resolveSession } from "../../../_helpers";

const csvCell = (value: string | number | null) => {
  let cell = value === null ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
};

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
    authorize(session, "hq:export", { kind: "org", organizationId: session.organizationId });
    const scope = authorizeHqScope(session);
    const params = request.nextUrl.searchParams;
    const day = params.get("date") ?? getDefaultDashboardDay();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T12:00:00Z`))) {
      return errorResponse("VALIDATION_ERROR", "Invalid business day", 400, requestId);
    }
    const areaId = params.get("areaId") || undefined;
    const outletId = params.get("outletId") || undefined;
    const statusRaw = params.get("status") || "ALL";
    const validStatuses = new Set(["ALL", "OPERATING", "ATTENTION", "REVIEW", "NOT_STARTED", "CLOSED"]);
    if (!validStatuses.has(statusRaw)) return errorResponse("VALIDATION_ERROR", "Invalid outlet status", 400, requestId);

    // Export uses the same server-side, session-scoped query as the dashboard, not browser table state.
    const snapshot = getHqDashboard({ scope, businessDay: day, areaId, outletId, status: statusRaw as any, search: params.get("search") || undefined, limit: 10_000 });
    const header = ["business_day", "generated_at", "source_watermark", "outlet", "operator", "started_at", "sales_idr", "transactions", "expenses_idr", "status"];
    const lines = [header.map(csvCell).join(",")];
    for (const row of snapshot.outlets) {
      lines.push([
        day,
        snapshot.generatedAt,
        snapshot.sourceWatermark,
        row.name,
        row.operatorName,
        row.startedAt,
        row.salesMinor,
        row.transactionCount,
        row.expensesMinor,
        row.status,
      ].map(csvCell).join(","));
    }

    const exportId = generateId();
    await writeAuditEvent({
      organizationId: session.organizationId,
      actorKind: "HQ_USER",
      actorId: session.userId,
      actorRole: session.roles.join(","),
      action: "export.created",
      subjectKind: "hq_dashboard_export",
      subjectId: exportId,
      correlationId: requestId,
      occurredAt: new Date(),
      afterSummary: { businessDay: day, areaId: areaId ?? null, outletId: outletId ?? null, status: statusRaw, rows: snapshot.outlets.length, generatedAt: snapshot.generatedAt, sourceWatermark: snapshot.sourceWatermark },
    });
    const csv = `\uFEFF${lines.join("\r\n")}\r\n`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="siomayops-dashboard-${day}.csv"`,
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return errorResponse("NOT_FOUND", error.message, 404, requestId);
    const status = (error as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    return errorResponse(status === 403 ? "FORBIDDEN" : "INTERNAL", status === 403 ? "Export access denied" : "Unable to create dashboard export", status, requestId);
  }
}
