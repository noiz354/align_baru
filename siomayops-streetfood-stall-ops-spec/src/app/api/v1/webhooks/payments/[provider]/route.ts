/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §9 — POST /webhooks/payments/{provider} (UNTRUSTED BOUNDARY).
 * Requirements: FR-PAYMENT-012, NFR-SEC-005. Task: T-PAY-003.
 * Verification order: signature → reference match → amount match → replay guard. Only then may
 * state change. Unmatched callbacks are recorded and alerted, never applied.
 */
import type { NextRequest } from "next/server";
import { providerCallbackEnvelopeSchema } from "@/shared/contracts/payments";

export const requestContract = providerCallbackEnvelopeSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ provider: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-PAY-003");
}
