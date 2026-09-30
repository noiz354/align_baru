import { z } from "zod";
import { uuidSchema, moneySchema, instantSchema } from "./common";
import { EXPENSE_CATEGORY_CODES } from "@/domain/expense/review";

export const expenseSubmitRequestSchema = z.object({
  shiftId: uuidSchema,
  categoryCode: z.enum(EXPENSE_CATEGORY_CODES),
  description: z.string().max(300).optional(),
  amount: moneySchema.extend({ amountMinor: z.number().int().positive() }).strict(),
  paidFrom: z.enum(["CASH_BOX", "PERSONAL"]),
  operatorNote: z.string().max(500).optional(),
  clientExpenseId: uuidSchema,
  recordedAtDevice: instantSchema.optional(),
}).strict();
export type ExpenseSubmitRequest = z.infer<typeof expenseSubmitRequestSchema>;

export const expenseReviewRequestSchema = z.object({
  decision: z.enum(["REVIEWED", "REJECTED", "ESCALATED"]),
  reason: z.string().trim().min(3).max(300),
}).strict();
