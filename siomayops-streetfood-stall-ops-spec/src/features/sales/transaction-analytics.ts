import { logger } from "@/server/telemetry/logger";

export type TransactionAnalyticsEvent =
  | "transactions_viewed"
  | "transaction_created"
  | "transaction_create_failed"
  | "transaction_filter_changed"
  | "transaction_detail_viewed";

/** Structured, privacy-minimal product events. Never attach notes, menu/customer PII, or payment references. */
export function trackTransactionEvent(
  eventName: TransactionAnalyticsEvent,
  properties: { status?: string; filter?: "businessDay" | "stallId" | "status"; requestId: string },
): void {
  logger.info("product_analytics", { eventName, page: "transactions", ...properties });
}
