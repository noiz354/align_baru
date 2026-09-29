/**
 * `GET /api/v1/hq/dashboard` — HTTP exposure of the authenticated dashboard boundary.
 *
 * Documented in `docs/integration/05-hq-dashboard-ui-integration.md`. The dashboard page calls the
 * boundary directly (server-side, no self-fetch); this route exists so the same contract is
 * reachable for tooling, tests and any future client transition, and so the boundary has one
 * HTTP-shaped error surface.
 *
 * Query: `?date=YYYY-MM-DD&outlet=<stallId>`
 */

import { NextRequest, NextResponse } from "next/server";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";
import { loadHqDashboard, type DashboardFailureKind } from "@/server/dashboard/boundary";

const FAILURE_STATUS: Record<DashboardFailureKind, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_FILTER: 400,
  UNAVAILABLE: 503,
};

const FAILURE_CODE: Record<DashboardFailureKind, string> = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_FILTER: "INVALID_FILTER",
  UNAVAILABLE: "DASHBOARD_UNAVAILABLE",
};

/** Operator-facing wording; deliberately contains no internal detail. */
const FAILURE_MESSAGE: Record<DashboardFailureKind, string> = {
  UNAUTHENTICATED: "Not authenticated",
  FORBIDDEN: "Role cannot read the HQ dashboard",
  INVALID_FILTER: "Date or outlet filter is not valid in this scope",
  UNAVAILABLE: "Dashboard data could not be loaded",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId();
  const url = new URL(request.url);

  const result = await loadHqDashboard(
    {
      date: url.searchParams.get("date"),
      outletId: url.searchParams.get("outlet"),
    },
    { resolveSession },
  );

  if (!result.ok) {
    return errorResponse(
      FAILURE_CODE[result.kind],
      FAILURE_MESSAGE[result.kind],
      FAILURE_STATUS[result.kind],
      requestId,
    );
  }

  return NextResponse.json(
    {
      data: result.model,
      meta: {
        computedAt: result.model.kpis.computedAt,
        freshnessBand: result.model.kpis.freshnessBand,
        businessDay: result.model.businessDay,
        scope: result.model.scope,
      },
    },
    { headers: { "X-Request-Id": requestId } },
  );
}
