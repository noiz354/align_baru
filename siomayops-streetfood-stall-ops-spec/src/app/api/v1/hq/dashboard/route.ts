import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/server/auth/port";
import { dashboardResponseSchema, dashboardStatusSchema } from "@/shared/contracts/dashboard";
import { logger, metrics } from "@/server/telemetry";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";
import { getDefaultDashboardDay, getHqDashboard, HqDashboardNotFoundError, type OutletStatus } from "@/features/hq/dashboard";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 0;
  const day = parts[2] ?? 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Expected a real calendar date");
const statusSchema = dashboardStatusSchema;

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const startedAt = performance.now();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);
    authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId });

    const params = request.nextUrl.searchParams;
    const date = params.get("date") ?? getDefaultDashboardDay();
    const parsedDate = dateSchema.safeParse(date);
    const statusRaw = params.get("status") ?? "ALL";
    const parsedStatus = statusSchema.safeParse(statusRaw);
    const limitRaw = Number(params.get("limit") ?? "6");
    if (!parsedDate.success || !parsedStatus.success || !Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > 100) {
      return errorResponse("VALIDATION_ERROR", "Invalid dashboard filters", 400, requestId, {
        date: parsedDate.success ? undefined : parsedDate.error.flatten(),
        status: parsedStatus.success ? undefined : parsedStatus.error.flatten(),
        limit: Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? undefined : "Limit must be between 1 and 100",
      });
    }

    const model = getHqDashboard({
      scope: session.scope,
      businessDay: parsedDate.data,
      outletId: params.get("outletId") || undefined,
      areaId: params.get("areaId") || undefined,
      search: params.get("search") || undefined,
      status: parsedStatus.data as "ALL" | OutletStatus,
      cursor: params.get("cursor") || undefined,
      limit: limitRaw,
    });
    const response = { data: model, meta: { requestId, freshnessBand: "current" as const } };
    const contractResult = dashboardResponseSchema.safeParse(response);
    if (!contractResult.success) {
      logger.error("Dashboard read model failed its page contract", contractResult.error, {
        organizationId: session.organizationId,
        actorId: session.userId,
        correlationId: requestId,
        route: "/api/v1/hq/dashboard",
      });
      metrics.increment("dashboard.read_model.contract_failure");
      return errorResponse("INTERNAL", "Dashboard data is unavailable", 500, requestId);
    }
    metrics.observeDuration("dashboard.read_model.latency", (performance.now() - startedAt) / 1000);
    return NextResponse.json(contractResult.data, {
      headers: { "X-Request-Id": requestId, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof HqDashboardNotFoundError) return errorResponse("NOT_FOUND", error.message, 404, requestId);
    const status = (error as { code?: string }).code === "FORBIDDEN" ? 403 : 500;
    if (status === 500) {
      logger.error("Dashboard read failed", error, { route: "/api/v1/hq/dashboard", correlationId: requestId });
      metrics.increment("dashboard.read.failure");
    }
    return errorResponse(status === 403 ? "FORBIDDEN" : "INTERNAL", status === 403 ? "Dashboard access denied" : "Unable to load dashboard data", status, requestId);
  }
}
