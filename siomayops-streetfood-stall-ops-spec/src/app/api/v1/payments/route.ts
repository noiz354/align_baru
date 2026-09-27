import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId } from "../_helpers";
import { memoryStore } from "@/server/db/memory-store";
import { authorize } from "@/server/auth/port";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try { authorize(session, "payment:view", { kind: "org", organizationId: session.organizationId }); } catch (e: any) { return errorResponse("FORBIDDEN", e.message, 403, requestId); }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  let payments = Array.from(memoryStore.payments.values()).filter((p: any) => p.organizationId === session.organizationId);
  if (status) payments = payments.filter((p: any) => p.status === status);
  payments = payments.sort((a: any,b: any) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);

  // Mask provider reference for non-finance roles per permissions
  const isFinance = session.roles.includes("HQ_FINANCE") || session.roles.includes("OWNER");
  const masked = payments.map((p: any) => ({
    ...p,
    providerReference: isFinance ? p.providerReference : p.providerReference ? `${p.providerReference.slice(0,4)}****` : null,
  }));

  return NextResponse.json({ data: masked, pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}
