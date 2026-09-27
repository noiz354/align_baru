import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "stock:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const stallId = url.searchParams.get("stallId");
  const stockItemId = url.searchParams.get("stockItemId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
  let movements = Array.from(memoryStore.stockMovements.values()).filter(m => m.organizationId === session.organizationId);
  if (stallId) movements = movements.filter(m => m.stallId === stallId);
  if (stockItemId) movements = movements.filter(m => m.stockItemId === stockItemId);
  movements = movements.sort((a,b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
  return NextResponse.json({ data: movements, pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}
