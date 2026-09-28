import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "menu:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }
  const policies = Array.from(memoryStore.pricePolicies.values()).filter(p => p.organizationId === session.organizationId && p.scope === "ORG");
  // map to latest per menuItem
  const latest: Record<string, typeof policies[0]> = {};
  for (const p of policies) {
    const existing = latest[p.menuItemId];
    if (!existing || p.effectiveFrom > existing.effectiveFrom) latest[p.menuItemId] = p;
  }
  const data = Object.values(latest).map(p => ({
    menuItemId: p.menuItemId,
    unitPriceMinor: p.unitPriceMinor,
    currency: p.currency,
    effectiveFrom: p.effectiveFrom,
  }));
  return NextResponse.json({ data, meta: { computedAt: new Date().toISOString() } }, { headers: { "X-Request-Id": requestId } });
}
