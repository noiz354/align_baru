import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveSession, errorResponse, getRequestId, getIdempotencyKey } from "../_helpers";
import { recordTransaction, getAuthorizedOutlets } from "@/features/sales";
import { getDashboardReadModel } from "@/features/hq";
import { repositories } from "@/server/db/repository";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) {
    return errorResponse("UNAUTHENTICATED", "Sesi tidak terautentikasi", 401, requestId);
  }
  const url = new URL(request.url);
  const outletId = url.searchParams.get("outletId") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const [{ items }, authorizedOutlets] = await Promise.all([
    repositories.sales.list(session.scope, { stallId: outletId, limit }),
    getAuthorizedOutlets(session),
  ]);
  return NextResponse.json(
    {
      data: items,
      authorizedOutlets,
      pagination: { limit },
    },
    { headers: { "X-Request-Id": requestId } }
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) {
    return errorResponse("UNAUTHENTICATED", "Sesi tidak terautentikasi", 401, requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("VALIDATION_FAILED", "Format JSON tidak valid", 400, requestId);
  }

  const headerKey = getIdempotencyKey(request);
  const bodyKey =
    typeof (body as any).clientTransactionId === "string"
      ? (body as any).clientTransactionId
      : typeof (body as any).clientSaleId === "string"
        ? (body as any).clientSaleId
        : "";
  const idempotencyKey = headerKey || bodyKey;

  try {
    const result = await recordTransaction(session, body, {
      idempotencyKey,
      correlationId: requestId,
    });

    try {
      revalidatePath("/hq");
      revalidatePath("/");
    } catch {}

    const dashboard = await getDashboardReadModel(session);

    const headers: Record<string, string> = { "X-Request-Id": requestId };
    if (result.replayed) {
      headers["X-Idempotent-Replayed"] = "true";
    }

    return NextResponse.json(
      {
        data: result,
        dashboard,
        replayed: result.replayed,
      },
      {
        status: result.replayed ? 200 : 201,
        headers,
      }
    );
  } catch (e: any) {
    const code = e.code || "INTERNAL";
    const status =
      e.status ||
      (code === "UNAUTHENTICATED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "CONFLICT"
              ? 409
              : code === "PRECONDITION_FAILED"
                ? 412
                : code === "IDEMPOTENCY_MISMATCH"
                  ? 422
                  : code === "VALIDATION_FAILED"
                    ? 400
                    : 500);
    return errorResponse(code, e.message || "Terjadi kesalahan server", status, requestId, e.details);
  }
}
