import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "location:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  const cursor = url.searchParams.get("cursor");
  const all = Array.from(memoryStore.sellingLocations.values()).filter(l => l.organizationId === session.organizationId);
  const startIdx = cursor ? all.findIndex(l => l.id === cursor) + 1 : 0;
  const page = all.slice(startIdx, startIdx + limit);
  const nextCursor = page.length === limit && all[startIdx + limit] ? all[startIdx + limit - 1]!.id : null;

  return NextResponse.json({ data: page, pagination: { nextCursor, limit } }, { headers: { "X-Request-Id": requestId } });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "location:manage", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const body = await request.json();
  const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const loc = {
    id,
    organizationId: session.organizationId,
    areaId: body.areaId || "area-1",
    name: body.name,
    status: "AVAILABLE" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.sellingLocations.set(id, loc as any);
  return NextResponse.json({ data: loc }, { status: 201, headers: { "X-Request-Id": requestId } });
}
