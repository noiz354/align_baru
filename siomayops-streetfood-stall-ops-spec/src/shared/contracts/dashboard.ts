import { z } from "zod";

/**
 * Page contract for the HQ dashboard. The server read model and the browser both
 * use this schema so a visually plausible response cannot silently become a
 * different shape at the integration boundary.
 */
export const dashboardStatusSchema = z.enum([
  "ALL",
  "OPERATING",
  "ATTENTION",
  "REVIEW",
  "NOT_STARTED",
  "CLOSED",
]);

export const dashboardAlertKindSchema = z.enum([
  "SHIFT_LOCATION_MISSING",
  "FLAGGED_EXPENSE",
  "INCIDENT",
  "RECORDED_ALERT",
]);

export const dashboardActivityKindSchema = z.enum([
  "SALE",
  "EXPENSE",
  "SHIFT",
  "PRODUCT",
  "OTHER",
]);

const isoDateTimeSchema = z.string().datetime({ offset: true });
const businessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneyMinorSchema = z.number().int();

export const dashboardOutletSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  areaId: z.string().min(1),
  operatorName: z.string().nullable(),
  operatorId: z.string().nullable(),
  activeShiftId: z.string().nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  salesMinor: moneyMinorSchema,
  transactionCount: z.number().int().nonnegative(),
  expensesMinor: moneyMinorSchema,
  status: dashboardStatusSchema.exclude(["ALL"]),
  statusReason: z.string().nullable(),
});

export const dashboardAlertSchema = z.object({
  id: z.string().min(1),
  outletId: z.string().nullable(),
  outletName: z.string().nullable(),
  kind: dashboardAlertKindSchema,
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  title: z.string(),
  description: z.string(),
  createdAt: isoDateTimeSchema,
  href: z.string().nullable(),
});

export const dashboardActivitySchema = z.object({
  id: z.string().min(1),
  occurredAt: isoDateTimeSchema,
  outletId: z.string().nullable(),
  outletName: z.string().nullable(),
  kind: dashboardActivityKindSchema,
  description: z.string(),
  amountMinor: moneyMinorSchema.nullable(),
  secondary: z.string().nullable(),
});

export const dashboardReadModelSchema = z.object({
  generatedAt: isoDateTimeSchema,
  sourceWatermark: isoDateTimeSchema.nullable(),
  scope: z.object({
    businessDay: businessDaySchema,
    outletId: z.string().nullable(),
    areaId: z.string().nullable(),
  }),
  kpis: z.object({
    salesMinor: moneyMinorSchema,
    previousDaySalesMinor: moneyMinorSchema,
    salesChangeBps: z.number().int().nullable(),
    transactionCount: z.number().int().nonnegative(),
    averageTransactionMinor: moneyMinorSchema,
    cashSalesMinor: moneyMinorSchema,
    digitalVerifiedMinor: moneyMinorSchema,
    digitalUnverifiedMinor: moneyMinorSchema,
    expensesMinor: moneyMinorSchema,
    expenseRatioBps: z.number().int().nonnegative(),
    activeOutlets: z.number().int().nonnegative(),
    totalOutlets: z.number().int().nonnegative(),
    notStartedOutlets: z.number().int().nonnegative(),
  }),
  salesTrend: z.array(z.object({
    label: z.string(),
    cumulativeMinor: moneyMinorSchema,
  })),
  alerts: z.array(dashboardAlertSchema),
  activity: z.array(dashboardActivitySchema),
  areaOptions: z.array(z.object({
    id: z.string().min(1),
  })),
  outletOptions: z.array(z.object({
    id: z.string().min(1),
    name: z.string(),
    areaId: z.string().min(1),
  })),
  outlets: z.array(dashboardOutletSummarySchema),
  pagination: z.object({
    limit: z.number().int().positive(),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  }),
});

export const dashboardResponseSchema = z.object({
  data: dashboardReadModelSchema,
  meta: z.object({
    requestId: z.string().min(1),
    freshnessBand: z.enum(["current", "recent", "stale"]),
  }),
});

export type DashboardStatus = z.infer<typeof dashboardStatusSchema>;
export type DashboardAlertKind = z.infer<typeof dashboardAlertKindSchema>;
export type DashboardActivityKind = z.infer<typeof dashboardActivityKindSchema>;
export type DashboardOutletSummary = z.infer<typeof dashboardOutletSummarySchema>;
export type DashboardAlert = z.infer<typeof dashboardAlertSchema>;
export type DashboardActivity = z.infer<typeof dashboardActivitySchema>;
export type DashboardReadModel = z.infer<typeof dashboardReadModelSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

/**
 * Input accepted by the dashboard server boundary. `organizationId` and actor
 * scope are deliberately absent; those come from the authenticated session.
 */
export type DashboardFilterInput = {
  readonly date?: string;
  readonly outletId?: string;
  readonly areaId?: string;
  readonly search?: string;
  readonly status?: DashboardStatus;
  readonly cursor?: string;
  readonly limit?: number;
};
