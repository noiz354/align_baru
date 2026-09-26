/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/**
 * API.md §10 — submit expense. Requirements: FR-EXPENSE-001..014, especially the neutral
 * UNVERIFIED_FIELD_EXPENSE policy (FR-EXPENSE-002/003/012, ADR-0027): no recipient identity,
 * no claimed authority, no asserted purpose are required or stored.
 */
export const expenseSubmitRequestSchema = z.object({
  shiftId: uuidSchema,
  categoryId: uuidSchema,
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
