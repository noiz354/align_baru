/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §15 — POST /loyalty/customers/identify.
 * Requirements: FR-LOYALTY-002/003. Task: T-LOY-001. Consent required; NOT offline.
 */
import type { NextRequest } from "next/server";
import { loyaltyIdentifyRequestSchema } from "@/shared/contracts/loyalty";

export const requestContract = loyaltyIdentifyRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-LOY-001");
}
