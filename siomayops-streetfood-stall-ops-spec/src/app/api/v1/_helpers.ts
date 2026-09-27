import { NextRequest, NextResponse } from "next/server";
import { createAuthPort } from "@/server/auth/port";
import { withIdempotency } from "@/server/db/idempotency";
import { createHash } from "crypto";

export function getRequestId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function errorResponse(code: string, message: string, status: number, requestId: string, details?: any) {
  return NextResponse.json({
    error: {
      code,
      message,
      requestId,
      retryable: status >= 500 || status === 429,
      details,
    }
  }, { status });
}

export async function resolveSession() {
  const authPort = createAuthPort();
  const session = await authPort.resolveSession();
  return session;
}

export function getIdempotencyKey(request: NextRequest): string {
  return request.headers.get("Idempotency-Key") || request.headers.get("idempotency-key") || "";
}

export function hashPayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex");
}

export async function handleWithIdempotency<T>(
  request: NextRequest,
  route: string,
  payload: unknown,
  fn: () => Promise<{ body: T; status: number }>
): Promise<NextResponse> {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) {
    return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  }
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) {
    // If no key provided, just execute (but log warning)
    try {
      const result = await fn();
      return NextResponse.json(result.body, { status: result.status, headers: { "X-Request-Id": requestId } });
    } catch (e: any) {
      const status = e.status || 500;
      const code = e.code || "INTERNAL";
      return errorResponse(code, e.message || "Internal error", status, requestId);
    }
  }

  const requestHash = hashPayload(payload);
  try {
    const result = await withIdempotency({
      organizationId: session.organizationId,
      route,
      idempotencyKey,
      requestHash,
      actorId: session.userId,
    }, fn);
    const headers: Record<string, string> = { "X-Request-Id": requestId };
    if (result.replayed) headers["X-Idempotent-Replayed"] = "true";
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (e: any) {
    if (e.code === "IDEMPOTENCY_MISMATCH") {
      return errorResponse("IDEMPOTENCY_MISMATCH", e.message, 422, requestId);
    }
    const status = e.status || 500;
    const code = e.code || "INTERNAL";
    return errorResponse(code, e.message || "Internal error", status, requestId);
  }
}
