import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "stock:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const items = Array.from(memoryStore.stockItems.values()).filter(i => i.organizationId === session.organizationId);
  // compute current quantity per stockItem as sum of movements
  const qtyByStock: Record<string, number> = {};
  for (const mov of memoryStore.stockMovements.values()) {
    if (mov.organizationId !== session.organizationId) continue;
    qtyByStock[mov.stockItemId] = (qtyByStock[mov.stockItemId] || 0) + mov.quantity;
  }

  const data = items.map(i => ({
    stockItemId: i.id,
    code: i.code,
    name: i.name,
    category: i.category,
    unit: i.unit,
    active: i.active,
    currentQty: qtyByStock[i.id] ?? 0,
  }));

  return NextResponse.json({ data, meta: { computedAt: new Date().toISOString() } }, { headers: { "X-Request-Id": requestId } });
}
