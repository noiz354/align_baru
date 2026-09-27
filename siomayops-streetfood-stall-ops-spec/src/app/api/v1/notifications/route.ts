import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore } from "@/server/db/memory-store";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);

  const notifications = Array.from(memoryStore.notifications?.values() || []).filter((n: any) => n.organizationId === session.organizationId && (n.recipientId === session.userId || n.recipientOperatorId === session.operatorId));
  return NextResponse.json({ data: notifications.slice(0, 100) }, { headers: { "X-Request-Id": requestId } });
}
