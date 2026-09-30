import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { getCatalogScopeTarget, listCatalogProducts, trackProductEvent } from "@/features/menu";
import { publishPricePolicy } from "@/features/pricing";
import { memoryStore } from "@/server/db/memory-store";
import { pricePolicyCreateRequestSchema } from "@/shared/contracts/pricing";
import { money } from "@/shared/money/money";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../../_helpers";

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "menu:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const locationId = request.nextUrl.searchParams.get("sellingLocationId") ?? undefined;
  if (locationId && memoryStore.sellingLocations.get(locationId)?.organizationId !== session.organizationId) {
    return errorResponse("NOT_FOUND", "Lokasi penjualan tidak ditemukan", 404, requestId);
  }
  const result = listCatalogProducts(session.organizationId, { sellingLocationId: locationId, limit: 100 });
  const data = result.data.flatMap((product) => product.active && product.effectivePrice ? [{
    menuItemId: product.id,
    unitPriceMinor: product.effectivePrice.amountMinor,
    currency: product.effectivePrice.currency,
    effectiveFrom: product.effectivePrice.effectiveFrom,
    effectiveTo: product.effectivePrice.effectiveTo,
    pricePolicyId: product.effectivePrice.policyId,
  }] : []);
  return NextResponse.json({ data, meta: { computedAt: result.effectiveAt, sellingLocationId: locationId ?? null } }, {
    headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const body = await request.json().catch(() => null);
  const parsed = pricePolicyCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    trackProductEvent("product_change_failed", { requestId, action: "price", status: "400" });
    return errorResponse("VALIDATION_ERROR", "Data harga tidak valid", 400, requestId, parsed.error.flatten());
  }
  if (!request.headers.get("Idempotency-Key")?.trim()) {
    trackProductEvent("product_change_failed", { requestId, action: "price", status: "400" });
    return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);
  }
  const session = await resolveSession();
  if (!session) {
    trackProductEvent("product_change_failed", { requestId, action: "price", status: "401" });
    return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  }
  const target = getCatalogScopeTarget({ organizationId: session.organizationId, scope: parsed.data.scope, scopeId: parsed.data.scopeId });
  if (!target) {
    trackProductEvent("product_change_failed", { requestId, action: "price", status: "404" });
    return errorResponse("NOT_FOUND", "Cakupan harga tidak ditemukan", 404, requestId);
  }
  try {
    authorize(session, "price:manage", target);
  } catch (error) {
    trackProductEvent("product_change_failed", { requestId, action: "price", status: "403" });
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const response = await handleWithIdempotency(request, "POST /api/v1/menu/prices", parsed.data, async () => {
    const policy = await publishPricePolicy({
      menuItemId: parsed.data.menuItemId,
      scope: parsed.data.scope,
      scopeId: parsed.data.scopeId,
      unitPrice: money(parsed.data.unitPrice.amountMinor, parsed.data.unitPrice.currency),
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : undefined,
      reason: parsed.data.reason,
      organizationId: session.organizationId,
      createdBy: session.userId,
      createdByRole: session.roles[0],
    });
    trackProductEvent("product_price_changed", { requestId, action: "price", status: "201" });
    return { body: { data: policy }, status: 201 };
  });
  if (!response.ok) trackProductEvent("product_change_failed", { requestId, action: "price", status: String(response.status) });
  return response;
}
