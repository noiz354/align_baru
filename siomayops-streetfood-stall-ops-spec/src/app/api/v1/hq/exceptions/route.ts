import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "hq:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const pendingPayments = Array.from(memoryStore.payments.values()).filter((p: any) => p.organizationId === session.organizationId && p.status === "PENDING_VERIFICATION").map((p: any) => ({ type: "payment_verification", id: p.id, amountMinor: p.amountMinor, ageMinutes: Math.floor((Date.now() - p.createdAt.getTime())/60000) }));
  const openIncidents = Array.from(memoryStore.incidents.values()).filter((i: any) => i.organizationId === session.organizationId && i.status !== "CLOSED").map((i: any) => ({ type: "incident", id: i.id, category: i.category }));
  const flaggedExpenses = Array.from(memoryStore.expenses.values()).filter((e: any) => e.organizationId === session.organizationId && ((e as any).flagged || (e as any).flaggedReason)).map((e: any) => ({ type: "expense_review", id: e.id }));

  const all = [...pendingPayments, ...openIncidents, ...flaggedExpenses];

  return NextResponse.json({
    data: { total: all.length, exceptions: all.slice(0, 100) },
    meta: { computedAt: new Date().toISOString(), freshnessBand: "current" as const, drillDown: { endpoint: "/api/v1/incidents" } },
  }, { headers: { "X-Request-Id": requestId } });
}
