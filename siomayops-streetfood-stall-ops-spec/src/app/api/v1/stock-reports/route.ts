/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §11 — POST /stock-reports (counts and non-count movements).
 * Requirements: FR-STOCK-002/006/007/012, ADR-0030 (neutral variance, UNKNOWN allowed).
 * Task: T-STOCK-002. Offline-OK.
 */
import type { NextRequest } from "next/server";
import { stockReportRequestSchema } from "@/shared/contracts/inventory";

export const requestContract = stockReportRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-STOCK-002");
}
