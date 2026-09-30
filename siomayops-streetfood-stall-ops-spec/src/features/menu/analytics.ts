import { logger } from "@/server/telemetry/logger";

export type ProductAnalyticsEvent =
  | "products_viewed"
  | "product_created"
  | "product_price_changed"
  | "product_status_changed"
  | "product_change_failed";

/** Coarse catalog events only; never log names, prices, IDs, reason text, or request bodies. */
export function trackProductEvent(
  eventName: ProductAnalyticsEvent,
  properties: { requestId: string; action?: "create" | "price" | "status"; status?: string; filter?: "search" | "categoryId" | "status" | "sellingLocationId" },
): void {
  logger.info("product_analytics", { eventName, page: "products", ...properties });
}
