/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §4 — POST /price-acknowledgements (digest-bound). Requirement: FR-PRICE-010. Task: T-PRICE-003.
 */
import type { NextRequest } from "next/server";
import { priceAcknowledgementRequestSchema } from "@/shared/contracts/pricing";

export const requestContract = priceAcknowledgementRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-PRICE-003");
}
