import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { canAccessExpenseShift, expenseScopeForShift, getExpense, trackExpenseEvent } from "@/features/expenses";
import { memoryStore } from "@/server/db/memory-store";
import { errorResponse, getRequestId, resolveSession } from "../../_helpers";

export async function GET(_request: NextRequest, context: { params: Promise<{ expenseId: string }> }) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "expense:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }
  const { expenseId } = await context.params;
  const detail = getExpense(session, expenseId);
  if (!detail) return errorResponse("NOT_FOUND", "Pengeluaran tidak ditemukan", 404, requestId);
  const target = expenseScopeForShift(detail.shiftId, session.organizationId);
  const stored = memoryStore.expenses.get(expenseId);
  let canReview = false;
  if (target && stored && session.userId !== stored.operatorId && session.operatorId !== stored.operatorId && canAccessExpenseShift(session, detail.shiftId)) {
    try {
      authorize(session, "expense:review", target);
      canReview = true;
    } catch {
      canReview = false;
    }
  }
  trackExpenseEvent("expense_detail_viewed", { requestId, status: detail.reviewStatus });
  return NextResponse.json({ data: { ...detail, canReview, ...(canReview && stored?.reviewReason ? { reviewReason: stored.reviewReason } : {}) } }, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}
