import { z } from "zod";

export const reportBusinessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}, "Expected a real business-day date");

const commonReportFilters = {
  dateFrom: reportBusinessDaySchema.optional(),
  dateTo: reportBusinessDaySchema.optional(),
  areaId: z.string().trim().min(1).max(160).optional(),
  outletId: z.string().trim().min(1).max(160).optional(),
};

export const reportReadQuerySchema = z.object({
  ...commonReportFilters,
  cursor: z.string().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict().superRefine((value, context) => {
  if ((value.dateFrom === undefined) !== (value.dateTo === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dateTo"], message: "Both dateFrom and dateTo are required together" });
  }
});

export const reportExportQuerySchema = z.object(commonReportFilters).strict().superRefine((value, context) => {
  if ((value.dateFrom === undefined) !== (value.dateTo === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dateTo"], message: "Both dateFrom and dateTo are required together" });
  }
});
