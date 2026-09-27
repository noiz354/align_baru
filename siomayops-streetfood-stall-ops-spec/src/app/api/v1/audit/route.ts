import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore, generateId } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "audit:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  const action = url.searchParams.get("action");
  const actorId = url.searchParams.get("actorId");
  const subjectId = url.searchParams.get("subjectId");

  let events = memoryStore.auditEvents.filter(e => e.organizationId === session.organizationId);
  if (action) events = events.filter(e => e.action === action);
  if (actorId) events = events.filter(e => (e as any).actorId === actorId);
  if (subjectId) events = events.filter(e => e.entityId === subjectId);

  events = events.sort((a,b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);

  // Audit the audit query itself per FR-AUDIT-005
  memoryStore.auditEvents.push({
    id: generateId(),
    organizationId: session.organizationId,
    actorKind: "USER",
    actorId: session.userId,
    action: "audit.queried",
    entityKind: "audit",
    entityId: "search",
    correlationId: requestId,
    occurredAt: new Date(),
    afterSummary: { filters: { action, actorId, subjectId } },
  } as any);

  return NextResponse.json({ data: events, pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}
