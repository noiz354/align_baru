import { logger } from "@/server/telemetry/logger";

export type ExpenseAnalyticsEvent =
  | "expenses_viewed"
  | "expense_created"
  | "expense_create_failed"
  | "expense_filter_changed"
  | "expense_detail_viewed"
  | "expense_reviewed"
  | "expense_review_failed";

/** Log coarse operational events only; never attach expense text, amounts, identities, or evidence. */
export function trackExpenseEvent(
  eventName: ExpenseAnalyticsEvent,
  properties: { requestId: string; status?: string; filter?: "businessDay" | "stallId" | "category" | "reviewStatus" | "paidFrom" },
): void {
  logger.info("product_analytics", { eventName, page: "expenses", ...properties });
}
