import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { memoryStore } from "@/server/db/memory-store";
import { getTransaction } from "@/features/sales";
import { trackTransactionEvent } from "@/features/sales/transaction-analytics";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";

export async function GET(_request: NextRequest, context: { params: Promise<{ transactionId: string }> }) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const { transactionId } = await context.params;
  const sale = memoryStore.sales.get(transactionId);
  if (!sale || sale.organizationId !== session.organizationId) return errorResponse("NOT_FOUND", "Transaksi tidak ditemukan", 404, requestId);
  try {
    authorize(session, "sale:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }
  const detail = getTransaction(session, transactionId);
  if (!detail) return errorResponse("NOT_FOUND", "Transaksi tidak ditemukan", 404, requestId);
  trackTransactionEvent("transaction_detail_viewed", { requestId, status: detail.status });
  return NextResponse.json({ data: detail }, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}
