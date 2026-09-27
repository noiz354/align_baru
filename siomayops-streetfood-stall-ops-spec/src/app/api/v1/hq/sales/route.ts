import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const sales = Array.from(memoryStore.sales.values()).filter((s: any) => s.organizationId === session.organizationId);
  const payments = Array.from(memoryStore.payments.values()).filter((p: any) => p.organizationId === session.organizationId);
  const cash = payments.filter((p: any) => p.method === "CASH" && p.status === "PAID").reduce((sum: number, p: any) => sum + p.amountMinor, 0);
  const digitalVerified = payments.filter((p: any) => p.status === "PAID" && p.method !== "CASH").reduce((sum: number, p: any) => sum + p.amountMinor, 0);
  const digitalUnverified = payments.filter((p: any) => p.status === "PENDING_VERIFICATION").reduce((sum: number, p: any) => sum + p.amountMinor, 0);

  return NextResponse.json({
    data: {
      grossByMethod: { CASH: { amountMinor: cash, currency: "IDR" }, DIGITAL_VERIFIED: { amountMinor: digitalVerified, currency: "IDR" }, DIGITAL_UNVERIFIED: { amountMinor: digitalUnverified, currency: "IDR" } },
      totalSales: sales.length,
    },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "current" as const, drillDown: { endpoint: "/api/v1/sales" } },
  }, { headers: { "X-Request-Id": requestId } });
}
