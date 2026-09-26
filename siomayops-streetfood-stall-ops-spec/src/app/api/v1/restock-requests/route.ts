/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §12 — POST /restock-requests. Requirements: FR-STOCK-004/005. Task: T-STOCK-004. Offline-OK.
 */
import type { NextRequest } from "next/server";
import { restockRequestSchema } from "@/shared/contracts/inventory";

export const requestContract = restockRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-STOCK-004");
}
