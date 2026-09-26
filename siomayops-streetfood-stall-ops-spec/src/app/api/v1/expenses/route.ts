/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §10 — POST /expenses.
 * Requirements: FR-EXPENSE-001/002/003/010/012 and the expense policy in PRD §9.2 / ADR-0027:
 * neutral categories (UNVERIFIED_FIELD_EXPENSE among them), no recipient identity, no claimed
 * authority, no asserted purpose, and no workflow that facilitates or optimises such a payment.
 * Task: T-EXP-001. Offline-OK.
 */
import type { NextRequest } from "next/server";
import { expenseSubmitRequestSchema } from "@/shared/contracts/expenses";

export const requestContract = expenseSubmitRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-EXP-001");
}
