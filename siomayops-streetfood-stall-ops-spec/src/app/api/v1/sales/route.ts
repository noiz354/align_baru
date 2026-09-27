import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId, handleWithIdempotency } from "../_helpers";
import { createSale } from "@/features/sales";
import { z } from "zod";

const CreateSaleSchema = z.object({
  shiftId: z.string(),
  clientSaleId: z.string(),
  lines: z.array(z.object({ menuItemId: z.string(), quantity: z.number().int().positive(), overridePriceMinor: z.number().int().optional() })),
  recordedAtDevice: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const { memoryStore } = await import("@/server/db/memory-store");
  const url = new URL(request.url);
  const shiftId = url.searchParams.get("shiftId");
  const businessDay = url.searchParams.get("businessDay");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  let sales = Array.from(memoryStore.sales.values()).filter(s => s.organizationId === session.organizationId);
  if (shiftId) sales = sales.filter(s => s.shiftId === shiftId);
  if (businessDay) sales = sales.filter(s => s.businessDay === businessDay);
  if (session.scope.kind === "self") {
    // Only own shifts
    sales = sales.filter(s => {
      const shift = memoryStore.shifts.get(s.shiftId);
      return shift?.operatorId === session.scope.operatorId;
    });
  }
  sales = sales.sort((a,b) => b.serverAcceptedAt.getTime() - a.serverAcceptedAt.getTime()).slice(0, limit);
  return NextResponse.json({ data: sales, pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    const requestId = getRequestId();
    return errorResponse("VALIDATION_ERROR", "Invalid JSON", 400, requestId);
  }
  const parsed = CreateSaleSchema.safeParse(body);
  if (!parsed.success) {
    const requestId = getRequestId();
    return errorResponse("VALIDATION_ERROR", "Invalid payload", 400, requestId, parsed.error.flatten());
  }
  return handleWithIdempotency(request, "POST /api/v1/sales", body, async () => {
    const session = await resolveSession();
    if (!session) throw Object.assign(new Error("Unauthenticated"), { status: 401, code: "UNAUTHENTICATED" });
    const sale = await createSale({
      shiftId: parsed.data.shiftId,
      lines: parsed.data.lines.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity, overridePriceMinor: l.overridePriceMinor })),
      clientSaleId: parsed.data.clientSaleId,
      recordedAtDevice: parsed.data.recordedAtDevice ? new Date(parsed.data.recordedAtDevice) : undefined,
      organizationId: session.organizationId,
    });
    return { body: { data: sale }, status: 201 };
  });
}
