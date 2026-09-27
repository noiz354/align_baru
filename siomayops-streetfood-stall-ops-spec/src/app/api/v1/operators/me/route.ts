import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../../_helpers";
import { memoryStore } from "@/server/db/memory-store";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);

  if (!session.operatorId) return errorResponse("NOT_FOUND", "No operator profile", 404, requestId);
  const operator = memoryStore.operators.get(session.operatorId);
  if (!operator) return errorResponse("NOT_FOUND", "Operator not found", 404, requestId);

  // Mask phone per privacy rules for self? Self can see own phone
  return NextResponse.json({ data: operator }, { headers: { "X-Request-Id": requestId } });
}
