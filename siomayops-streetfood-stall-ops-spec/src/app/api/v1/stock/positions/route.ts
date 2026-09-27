import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";
import { deriveStockPosition } from "@/domain/inventory/variance";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "stock:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const stallId = url.searchParams.get("stallId");
  const stockItemId = url.searchParams.get("stockItemId");
  let movements = Array.from(memoryStore.stockMovements.values()).filter((m: any) => m.organizationId === session.organizationId);
  if (stallId) movements = movements.filter((m: any) => m.stallId === stallId);
  if (stockItemId) movements = movements.filter((m: any) => m.stockItemId === stockItemId);

  // Group by stockItemId and stallId
  const groups = new Map<string, typeof movements>();
  for (const m of movements) {
    const key = `${(m as any).stallId || "unknown"}:${(m as any).stockItemId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }
  const positions = Array.from(groups.entries()).map(([key, ms]) => {
    const [sId, itemId] = key.split(":");
    try {
      const mapped = ms.map((mm: any) => ({
        movementId: mm.id,
        stallId: mm.stallId || "stall-1",
        stockItemId: mm.stockItemId,
        kind: (mm.movementType === "ISSUE" ? "ISSUE" : mm.movementType === "WASTE" ? "WASTE" : mm.movementType === "TRANSFER_OUT" ? "TRANSFER_OUT" : "ISSUE") as any,
        quantity: mm.quantity,
        recordedBy: mm.actorId || "system",
        occurredAt: mm.occurredAt,
        clientMovementId: mm.clientMovementId,
      }));
      const pos = deriveStockPosition(mapped as any);
      return { stallId: sId, stockItemId: itemId, quantity: pos.quantity, derivedAt: new Date().toISOString() };
    } catch {
      return { stallId: sId, stockItemId: itemId, quantity: 0, derivedAt: new Date().toISOString(), error: "No movements" };
    }
  });

  return NextResponse.json({ data: positions, meta: { computedAt: new Date().toISOString() } }, { headers: { "X-Request-Id": requestId } });
}
