import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/server/auth/port";
import { canAccessExpenseShift, expenseScopeForShift, getExpense, listExpenses, submitExpense, trackExpenseEvent } from "@/features/expenses";
import { memoryStore } from "@/server/db/memory-store";
import { EXPENSE_CATEGORY_CODES } from "@/domain/expense/review";
import { expenseSubmitRequestSchema } from "@/shared/contracts/expenses";
import { money } from "@/shared/money/money";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../_helpers";

const ReviewStatusSchema = z.enum(["SUBMITTED", "REVIEW_REQUIRED", "REVIEWED", "REJECTED", "ESCALATED"]);
const PaidFromSchema = z.enum(["CASH_BOX", "PERSONAL"]);
const CategorySchema = z.enum(EXPENSE_CATEGORY_CODES);

function parseInteger(value: string | null, fallback: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function failedCreate(code: string, message: string, status: number, requestId: string, details?: unknown) {
  trackExpenseEvent("expense_create_failed", { requestId, status: String(status) });
  return errorResponse(code, message, status, requestId, details);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "expense:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const params = request.nextUrl.searchParams;
  const businessDay = params.get("businessDay") ?? undefined;
  const stallId = params.get("stallId") ?? undefined;
  const categoryRaw = params.get("category") ?? undefined;
  const statusRaw = params.get("reviewStatus") ?? params.get("reviewState") ?? undefined;
  const paidFromRaw = params.get("paidFrom") ?? undefined;
  const limit = parseInteger(params.get("limit"), 25);
  const offset = parseInteger(params.get("offset"), 0);
  const validDay = !businessDay || (/^\d{4}-\d{2}-\d{2}$/.test(businessDay) && !Number.isNaN(Date.parse(`${businessDay}T00:00:00Z`)) && new Date(`${businessDay}T00:00:00Z`).toISOString().slice(0, 10) === businessDay);
  if (!validDay || (stallId && stallId.length > 100) || limit === null || limit < 1 || limit > 100 || offset === null || offset > 100000) {
    return errorResponse("VALIDATION_ERROR", "Filter tidak valid", 400, requestId);
  }
  const category = categoryRaw ? CategorySchema.safeParse(categoryRaw) : undefined;
  const reviewStatus = statusRaw ? ReviewStatusSchema.safeParse(statusRaw) : undefined;
  const paidFrom = paidFromRaw ? PaidFromSchema.safeParse(paidFromRaw) : undefined;
  if ((category && !category.success) || (reviewStatus && !reviewStatus.success) || (paidFrom && !paidFrom.success)) {
    return errorResponse("VALIDATION_ERROR", "Filter tidak valid", 400, requestId);
  }
  const result = listExpenses(session, {
    businessDay,
    stallId,
    category: category?.success ? category.data : undefined,
    reviewStatus: reviewStatus?.success ? reviewStatus.data : undefined,
    paidFrom: paidFrom?.success ? paidFrom.data : undefined,
    limit,
    offset,
  });
  let canSubmit = false;
  try { authorize(session, "expense:submit", { kind: "org", organizationId: session.organizationId }); canSubmit = true; } catch { /* View-only role. */ }
  const filter = businessDay ? "businessDay" : stallId ? "stallId" : categoryRaw ? "category" : statusRaw ? "reviewStatus" : paidFromRaw ? "paidFrom" : undefined;
  trackExpenseEvent(filter ? "expense_filter_changed" : "expenses_viewed", {
    requestId,
    ...(filter ? { filter } : {}),
  });
  return NextResponse.json({ data: result.data, outlets: result.outlets, canSubmit, pagination: { total: result.total, limit: result.limit, offset: result.offset } }, {
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const body = await request.json().catch(() => null);
  const parsed = expenseSubmitRequestSchema.safeParse(body);
  if (!parsed.success) return failedCreate("VALIDATION_ERROR", "Data pengeluaran tidak valid", 400, requestId, parsed.error.flatten());
  if (!request.headers.get("Idempotency-Key")?.trim()) {
    return failedCreate("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);
  }
  const session = await resolveSession();
  if (!session) return failedCreate("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const target = expenseScopeForShift(parsed.data.shiftId, session.organizationId);
  if (!target) return failedCreate("NOT_FOUND", "Shift tidak ditemukan", 404, requestId);
  try {
    authorize(session, "expense:submit", target);
  } catch (error) {
    return failedCreate("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }
  if (!canAccessExpenseShift(session, parsed.data.shiftId)) {
    return failedCreate("FORBIDDEN", "Shift berada di luar cakupan akun ini", 403, requestId);
  }
  const shift = memoryStore.shifts.get(parsed.data.shiftId);
  if (!shift || (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC")) {
    return failedCreate("PRECONDITION_FAILED", "Operasional tidak terbuka untuk mencatat pengeluaran", 409, requestId);
  }

  const response = await handleWithIdempotency(request, "POST /api/v1/expenses", parsed.data, async () => {
    const expense = await submitExpense({
      shiftId: parsed.data.shiftId,
      categoryCode: parsed.data.categoryCode,
      description: parsed.data.description,
      amount: money(parsed.data.amount.amountMinor, parsed.data.amount.currency),
      paidFrom: parsed.data.paidFrom,
      operatorNote: parsed.data.operatorNote,
      clientExpenseId: parsed.data.clientExpenseId,
      recordedAtDevice: parsed.data.recordedAtDevice ? new Date(parsed.data.recordedAtDevice) : undefined,
      organizationId: session.organizationId,
      actorId: session.operatorId ?? session.userId,
      actorKind: session.roles.includes("OPERATOR") ? "OPERATOR" : "HQ_USER",
    });
    const created = getExpense(session, expense.expenseId);
    trackExpenseEvent("expense_created", { requestId, status: created?.reviewStatus ?? "SUBMITTED" });
    return { body: { data: created ?? { expenseId: expense.expenseId } }, status: 201 };
  });
  if (!response.ok) trackExpenseEvent("expense_create_failed", { requestId, status: String(response.status) });
  return response;
}
