import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, getRequestId, resolveSession } from "../_helpers";
import { emitAnalytics, type AnalyticsEventName } from "@/server/telemetry/analytics";

const analyticsSchema = z.object({
  name: z.enum(["dashboard_viewed", "dashboard_filter_changed", "dashboard_outlet_opened", "dashboard_error_shown"]),
  pageId: z.string().max(128),
  properties: z.record(z.string(), z.union([z.string().max(256), z.number(), z.boolean(), z.null()])),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  try {
    const session = await resolveSession();
    if (!session) return errorResponse("UNAUTHENTICATED", "Sign in is required", 401, requestId);

    const body = await request.json();
    const parsed = analyticsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid analytics event", 400, requestId, parsed.error.flatten());
    }

    emitAnalytics({
      name: parsed.data.name as AnalyticsEventName,
      pageId: parsed.data.pageId,
      actorId: session.userId,
      organizationId: session.organizationId,
      properties: parsed.data.properties,
    });

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return errorResponse("INTERNAL", "Unable to record analytics event", 500, requestId);
  }
}
