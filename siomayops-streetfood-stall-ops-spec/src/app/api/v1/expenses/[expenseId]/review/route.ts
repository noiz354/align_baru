import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { canAccessExpenseShift, expenseScopeForShift, reviewExpense, trackExpenseEvent } from "@/features/expenses";
import { expenseReviewRequestSchema } from "@/shared/contracts/expenses";
import { memoryStore } from "@/server/db/memory-store";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../../../_helpers";

export async function POST(request: NextRequest, context: { params: Promise<{ expenseId: string }> }) {
  const requestId = getRequestId();
  const { expenseId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = expenseReviewRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Keputusan tinjauan tidak valid", 400, requestId, parsed.error.flatten());
  if (!request.headers.get("Idempotency-Key")?.trim()) return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);

  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const expense = memoryStore.expenses.get(expenseId);
  if (!expense || expense.organizationId !== session.organizationId) return errorResponse("NOT_FOUND", "Pengeluaran tidak ditemukan", 404, requestId);
  const target = expenseScopeForShift(expense.shiftId, session.organizationId);
  if (!target) return errorResponse("NOT_FOUND", "Pengeluaran tidak ditemukan", 404, requestId);
  try {
    authorize(session, "expense:review", target);
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }
  if (!canAccessExpenseShift(session, expense.shiftId)) return errorResponse("FORBIDDEN", "Pengeluaran berada di luar cakupan akun ini", 403, requestId);
  if (session.userId === expense.operatorId || session.operatorId === expense.operatorId) {
    return errorResponse("FORBIDDEN", "Pengaju tidak dapat meninjau pengeluarannya sendiri", 403, requestId);
  }

  const response = await handleWithIdempotency(request, `POST /api/v1/expenses/${expenseId}/review`, parsed.data, async () => {
    const result = await reviewExpense({
      expenseId,
      decision: parsed.data.decision,
      reason: parsed.data.reason,
      reviewedBy: session.userId,
      reviewerRole: session.roles[0],
      reviewerOperatorId: session.operatorId,
      organizationId: session.organizationId,
    });
    return { body: { data: result }, status: 200 };
  });
  if (response.headers.get("X-Idempotent-Replayed") !== "true") {
    trackExpenseEvent(response.ok ? "expense_reviewed" : "expense_review_failed", { requestId, status: String(response.status) });
  }
  return response;
}
