import { z } from "zod";

export const dashboardAnalyticsEventSchema = z.object({
  event: z.enum([
    "dashboard_viewed",
    "dashboard_filter_changed",
    "dashboard_outlet_opened",
    "dashboard_error_shown",
  ]),
  page: z.literal("dashboard"),
  businessDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["ALL", "OPERATING", "ATTENTION", "REVIEW", "NOT_STARTED", "CLOSED"]).optional(),
  outletId: z.string().min(1).optional(),
  areaId: z.string().min(1).optional(),
  hasSearch: z.boolean().optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  errorCode: z.enum(["UNAUTHENTICATED", "FORBIDDEN", "VALIDATION_ERROR", "NOT_FOUND", "INTERNAL", "NETWORK"]).optional(),
});

export type DashboardAnalyticsEvent = z.infer<typeof dashboardAnalyticsEventSchema>;
