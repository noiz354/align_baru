/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §6 — POST /sales/{saleId}/complete (payment resolution).
 * Requirements: FR-SALE-007, FR-CASH-001/002. Task: T-SALE-002. Cash completes offline; digital does not.
 */
import type { NextRequest } from "next/server";
import { cashPaymentRequestSchema } from "@/shared/contracts/payments";

export const requestContract = cashPaymentRequestSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ saleId: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-SALE-002");
}
