/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §7 — POST /payments/cash. Requirements: FR-PAYMENT-001, FR-CASH-001..003.
 * Task: T-SALE-002. Cash is first-class and works fully offline.
 */
import type { NextRequest } from "next/server";
import { cashPaymentRequestSchema } from "@/shared/contracts/payments";

export const requestContract = cashPaymentRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-SALE-002");
}
