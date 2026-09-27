import { z } from "zod";
import { uuidSchema, uuidV7Schema, moneySchema, instantSchema } from "./common";

export const expenseSubmitRequestSchema = z.object({
  shiftId: uuidSchema,
  categoryId: uuidSchema.optional(),
  categoryCode: z.string().optional(),
  description: z.string().min(3).max(300),
  amount: moneySchema,
  paidFrom: z.enum(["CASH_BOX", "PERSONAL"]),
  operatorNote: z.string().max(500).optional(),
  evidenceAssetId: uuidSchema.optional(),
  clientExpenseId: uuidV7Schema,
  recordedAtDevice: instantSchema.optional()
});
export type ExpenseSubmitRequest = z.infer<typeof expenseSubmitRequestSchema>;

export const expenseReviewRequestSchema = z.object({
  expenseId: uuidSchema,
  decision: z.enum(["REVIEWED", "REJECTED", "ESCALATED"]),
  reason: z.string().min(3).max(300)
});
