import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/server/auth/port";
import { memoryStore } from "@/server/db/memory-store";
import { createCashPayment } from "@/features/payments";
import { canAccessShift, createSale, listTransactions, recordTransaction, transactionScopeForShift } from "@/features/sales";
import { trackTransactionEvent } from "@/features/sales/transaction-analytics";
import { money } from "@/shared/money/money";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../_helpers";

const StatusSchema = z.enum(["DRAFT", "COMPLETED", "VOIDED", "CORRECTED"]);
const CreateTransactionSchema = z.object({
  shiftId: z.string().min(1).max(100),
  clientSaleId: z.string().min(1).max(100),
  clientPaymentId: z.string().min(1).max(100),
  lines: z.array(z.object({ menuItemId: z.string().min(1).max(100), quantity: z.number().int().positive().max(100) })).min(1).max(50),
  cashReceivedMinor: z.number().int().positive().safe(),
  occurredAtDevice: z.string().datetime().optional(),
}).strict();

function parseInteger(value: string | null, fallback: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function failedCreate(code: string, message: string, status: number, requestId: string, details?: unknown) {
  trackTransactionEvent("transaction_create_failed", { requestId, status: String(status) });
  return errorResponse(code, message, status, requestId, details);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "sale:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const params = request.nextUrl.searchParams;
  const businessDay = params.get("businessDay") ?? undefined;
  const stallId = params.get("stallId") ?? params.get("outletId") ?? undefined;
  const statusRaw = params.get("status") ?? undefined;
  const limit = parseInteger(params.get("limit"), 25);
  const offset = parseInteger(params.get("offset"), 0);
  const validDay = !businessDay || (/^\d{4}-\d{2}-\d{2}$/.test(businessDay) && !Number.isNaN(Date.parse(`${businessDay}T00:00:00Z`)) && new Date(`${businessDay}T00:00:00Z`).toISOString().slice(0, 10) === businessDay);
  if (!validDay || (stallId && stallId.length > 100) || limit === null || limit < 1 || limit > 100 || offset === null || offset > 100000) {
    return errorResponse("VALIDATION_ERROR", "Filter tidak valid", 400, requestId);
  }
  const status = statusRaw ? StatusSchema.safeParse(statusRaw) : undefined;
  if (status && !status.success) return errorResponse("VALIDATION_ERROR", "Status tidak valid", 400, requestId);
  const result = listTransactions(session, { businessDay, stallId, status: status?.success ? status.data : undefined, limit, offset });
  trackTransactionEvent((businessDay || stallId || statusRaw) ? "transaction_filter_changed" : "transactions_viewed", {
    requestId,
    ...(businessDay ? { filter: "businessDay" as const } : stallId ? { filter: "stallId" as const } : statusRaw ? { filter: "status" as const } : {}),
  });
  return NextResponse.json({ data: result.data, outlets: result.outlets, pagination: { total: result.total, limit: result.limit, offset: result.offset } }, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const body = await request.json().catch(() => null);
  // Finance/HQ's amount-based write flow is supported alongside the operator line-item POS flow.
  if (body && typeof body === "object" && !Array.isArray(body) && "outletId" in body) {
    const directSession = await resolveSession();
    if (!directSession) return failedCreate("UNAUTHENTICATED", "Not authenticated", 401, requestId);
    try {
      const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || (typeof (body as any).clientTransactionId === "string" ? (body as any).clientTransactionId : "");
      const result = await recordTransaction(directSession, body, { idempotencyKey, correlationId: requestId });
      const headers: Record<string, string> = { "X-Request-Id": requestId, "Cache-Control": "no-store" };
      if (result.replayed) headers["X-Idempotent-Replayed"] = "true";
      return NextResponse.json({ data: result, replayed: result.replayed }, { status: result.replayed ? 200 : 201, headers });
    } catch (error: any) {
      const status = error.status ?? (error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : error.code === "IDEMPOTENCY_MISMATCH" ? 422 : error.code === "UNAUTHENTICATED" ? 401 : 400);
      return failedCreate(error.code ?? "VALIDATION_ERROR", error.message ?? "Data transaksi tidak valid", status, requestId, error.details);
    }
  }
  const parsed = CreateTransactionSchema.safeParse(body);
  if (!parsed.success) return failedCreate("VALIDATION_ERROR", "Data transaksi tidak valid", 400, requestId, parsed.error.flatten());
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey?.trim()) return failedCreate("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);

  const session = await resolveSession();
  if (!session) return failedCreate("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  const target = transactionScopeForShift(parsed.data.shiftId, session.organizationId);
  if (!target) return failedCreate("NOT_FOUND", "Shift tidak ditemukan", 404, requestId);
  try {
    authorize(session, "sale:create", target);
    authorize(session, "payment:cash", target);
  } catch (error) {
    return failedCreate("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }
  const shift = memoryStore.shifts.get(parsed.data.shiftId);
  if (!shift || (shift.status !== "OPEN" && shift.status !== "PENDING_SYNC")) {
    return failedCreate("PRECONDITION_FAILED", "Operasional belum terbuka untuk transaksi", 409, requestId);
  }
  if (!canAccessShift(session, shift.id)) return failedCreate("FORBIDDEN", "Shift berada di luar cakupan akses akun ini", 403, requestId);
  const duplicateSaleId = memoryStore.saleByClientId.get(parsed.data.clientSaleId);
  const duplicateSale = duplicateSaleId ? memoryStore.sales.get(duplicateSaleId) : undefined;
  if (duplicateSale && duplicateSale.organizationId !== session.organizationId) {
    return failedCreate("CONFLICT", "ID transaksi sudah digunakan", 409, requestId);
  }

  const response = await handleWithIdempotency(request, "POST /api/v1/transactions", parsed.data, async () => {
    const sale = await createSale({
      shiftId: parsed.data.shiftId,
      lines: parsed.data.lines,
      clientSaleId: parsed.data.clientSaleId,
      recordedAtDevice: parsed.data.occurredAtDevice ? new Date(parsed.data.occurredAtDevice) : undefined,
      organizationId: session.organizationId,
    });
    const payment = await createCashPayment({
      saleId: sale.saleId,
      amount: sale.total,
      cashReceived: money(parsed.data.cashReceivedMinor, "IDR"),
      clientPaymentId: parsed.data.clientPaymentId,
      organizationId: session.organizationId,
      actorId: session.operatorId ?? session.userId,
    });
    trackTransactionEvent("transaction_created", { requestId, status: payment.status });
    return { body: { data: { transactionId: sale.saleId, status: payment.status, totalMinor: sale.total.amountMinor, changeMinor: payment.change.amountMinor, currency: "IDR" } }, status: 201 };
  });
  if (!response.ok) trackTransactionEvent("transaction_create_failed", { requestId, status: String(response.status) });
  return response;
}
