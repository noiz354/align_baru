import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/server/auth/port";
import { listCatalogProducts, trackProductEvent, upsertMenuItem } from "@/features/menu";
import { memoryStore } from "@/server/db/memory-store";
import { menuItemCreateRequestSchema } from "@/shared/contracts/pricing";
import { errorResponse, getRequestId, handleWithIdempotency, resolveSession } from "../../_helpers";

function parseInteger(value: string | null, fallback: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
function can(session: Awaited<ReturnType<typeof resolveSession>>, action: "menu:manage" | "price:manage"): boolean {
  if (!session) return false;
  try { authorize(session, action, { kind: "org", organizationId: session.organizationId }); return true; } catch { return false; }
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId();
  const session = await resolveSession();
  if (!session) return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  try {
    authorize(session, "menu:view", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const params = request.nextUrl.searchParams;
  const search = params.get("search") ?? undefined;
  const categoryId = params.get("categoryId") ?? undefined;
  const statusRaw = params.get("status") ?? undefined;
  const sellingLocationId = params.get("sellingLocationId") ?? undefined;
  const limit = parseInteger(params.get("limit"), 50);
  const offset = parseInteger(params.get("offset"), 0);
  if ((search && search.length > 100) || (categoryId && categoryId.length > 100)
    || (sellingLocationId && sellingLocationId.length > 100)
    || (statusRaw && statusRaw !== "ACTIVE" && statusRaw !== "INACTIVE")
    || limit === null || limit < 1 || limit > 100 || offset === null || offset > 100000) {
    return errorResponse("VALIDATION_ERROR", "Filter produk tidak valid", 400, requestId);
  }
  if (sellingLocationId && memoryStore.sellingLocations.get(sellingLocationId)?.organizationId !== session.organizationId) {
    return errorResponse("NOT_FOUND", "Lokasi penjualan tidak ditemukan", 404, requestId);
  }

  const result = listCatalogProducts(session.organizationId, {
    search,
    categoryId,
    status: statusRaw as "ACTIVE" | "INACTIVE" | undefined,
    sellingLocationId,
    limit,
    offset,
  });
  const filter = search ? "search" : categoryId ? "categoryId" : statusRaw ? "status" : sellingLocationId ? "sellingLocationId" : undefined;
  trackProductEvent("products_viewed", { requestId, ...(filter ? { filter } : {}) });
  return NextResponse.json({
    ...result,
    scopeOptions: { organizationId: session.organizationId, areas: result.areas, locations: result.locations },
    capabilities: { canManageProducts: can(session, "menu:manage"), canManagePrices: can(session, "price:manage") },
  }, { headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId();
  const body = await request.json().catch(() => null);
  const parsed = menuItemCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    trackProductEvent("product_change_failed", { requestId, action: "create", status: "400" });
    return errorResponse("VALIDATION_ERROR", "Data produk tidak valid", 400, requestId, parsed.error.flatten());
  }
  if (!request.headers.get("Idempotency-Key")?.trim()) {
    trackProductEvent("product_change_failed", { requestId, action: "create", status: "400" });
    return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Kunci idempotensi wajib diisi", 400, requestId);
  }
  const session = await resolveSession();
  if (!session) {
    trackProductEvent("product_change_failed", { requestId, action: "create", status: "401" });
    return errorResponse("UNAUTHENTICATED", "Not authenticated", 401, requestId);
  }
  try {
    authorize(session, "menu:manage", { kind: "org", organizationId: session.organizationId });
  } catch (error) {
    trackProductEvent("product_change_failed", { requestId, action: "create", status: "403" });
    return errorResponse("FORBIDDEN", error instanceof Error ? error.message : "Forbidden", 403, requestId);
  }

  const response = await handleWithIdempotency(request, "POST /api/v1/menu/items", parsed.data, async () => {
    const product = await upsertMenuItem({
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      kind: "SELLABLE",
      reason: parsed.data.reason,
      organizationId: session.organizationId,
      actorId: session.userId,
      actorRole: session.roles[0],
    });
    const stored = memoryStore.menuItems.get(product.menuItemId);
    trackProductEvent("product_created", { requestId, action: "create", status: "201" });
    return { body: { data: stored ?? product }, status: 201 };
  });
  if (!response.ok) trackProductEvent("product_change_failed", { requestId, action: "create", status: String(response.status) });
  return response;
}
