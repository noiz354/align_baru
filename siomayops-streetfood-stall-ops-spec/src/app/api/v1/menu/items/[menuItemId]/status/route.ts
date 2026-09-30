import { NextRequest } from "next/server";
import { authorize } from "@/server/auth/port";
import { setMenuItemStatus, trackProductEvent } from "@/features/menu";
import { menuItemStatusRequestSchema } from "@/shared/contracts/pricing";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../../../../_helpers";

export async function PATCH(request: NextRequest, context: { params: Promise<{ menuItemId: string }> }) {
  const requestId = getRequestId();
  const { menuItemId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = menuItemStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    trackProductEvent("product_change_failed", { requestId, action: "status", status: "400" });
    return errorResponse("VALIDATION_ERROR", "Perubahan status produk tidak valid", 400, requestId, parsed.error.flatten());
  }
  if (!request.headers.get("Idempotency-Key")?.trim()) {
    trackProductEvent("product_change_failed", { requestId, action: "status", status: "400" });
    return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);
  }
  const session = await resolveSession();
  if (!session) {
    trackProductEvent("product_change_failed", { requestId, action: "status", status: "401" });
    return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  }
  try {
    authorize(session, "menu:manage", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    trackProductEvent("product_change_failed", { requestId, action: "status", status: "403" });
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const response = await handleWithIdempotency(request, `PATCH /api/v1/menu/items/${menuItemId}/status`, parsed.data, async () => {
    const result = await setMenuItemStatus({
      menuItemId,
      active: parsed.data.active,
      reason: parsed.data.reason,
      organizationId: session.organizationId,
      actorId: session.userId,
      actorRole: session.roles[0],
    });
    return { body: { data: result }, status: 200 };
  });
  if (response.headers.get("X-Idempotent-Replayed") !== "true") {
    trackProductEvent(response.ok ? "product_status_changed" : "product_change_failed", { requestId, action: "status", status: String(response.status) });
  }
  return response;
}
