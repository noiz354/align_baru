/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §8 — POST /payments/digital. Requirements: FR-PAYMENT-002/003/006/008, ADR-0033.
 * Task: T-PAY-002.
 * REQUIRES CONNECTIVITY: this endpoint must never be queued offline and must never be able to
 * produce a PAID state on its own. The honest starting state is PENDING / PENDING_VERIFICATION.
 */
import type { NextRequest } from "next/server";
import { digitalPaymentRequestSchema } from "@/shared/contracts/payments";

export const requestContract = digitalPaymentRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-PAY-002");
}
