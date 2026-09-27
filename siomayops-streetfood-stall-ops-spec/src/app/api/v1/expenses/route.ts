import { NextRequest, NextResponse } from "next/server";
import { resolveSession, errorResponse, getRequestId, handleWithIdempotency } from "../_helpers";
import { submitExpense, listExpensesForReview } from "@/features/expenses";
import { z } from "zod";
import { money } from "@/shared/money/money";

const CreateExpenseSchema = z.object({
  shiftId: z.string(),
  categoryCode: z.string(),
  description: z.string().min(3),
  amountMinor: z.number().int().positive(),
  currency: z.string().default("IDR"),
  paidFrom: z.enum(["CASH_BOX", "PERSONAL"]),
  operatorNote: z.string().optional(),
  evidenceAssetId: z.string().optional(),
  clientExpenseId: z.string(),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const url = new URL(request.url);
  const reviewState = url.searchParams.get("reviewState") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 200);
  const result = await listExpensesForReview(session.organizationId, reviewState as any);
  return NextResponse.json({ data: result.slice(0, limit), pagination: { limit } }, { headers: { "X-Request-Id": requestId } });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    const requestId = getRequestId();
    return errorResponse("VALIDATION_ERROR", "Invalid JSON", 400, requestId);
  }
  const parsed = CreateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    const requestId = getRequestId();
    return errorResponse("VALIDATION_ERROR", "Invalid payload", 400, requestId, parsed.error.flatten());
  }
  return handleWithIdempotency(request, "POST /api/v1/expenses", body, async () => {
    const session = await resolveSession();
    if (!session) throw Object.assign(new Error("Unauthenticated"), { status: 401, code: "UNAUTHENTICATED" });
    const expense = await submitExpense({
      shiftId: parsed.data.shiftId,
      categoryCode: parsed.data.categoryCode as any,
      description: parsed.data.description,
      amount: money(parsed.data.amountMinor, "IDR"),
      paidFrom: parsed.data.paidFrom as any,
      operatorNote: parsed.data.operatorNote,
      evidenceAssetId: parsed.data.evidenceAssetId,
      clientExpenseId: parsed.data.clientExpenseId,
      organizationId: session.organizationId,
      operatorId: session.operatorId,
    });
    return { body: { data: expense }, status: 201 };
  });
}
