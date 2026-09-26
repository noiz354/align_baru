/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §5 — POST /sales (Create Sale). Requirements: FR-SALE-001/003/006/011, ADR-0010.
 * Task: T-SALE-001. Price snapshots are taken at acceptance; nothing is recalculated later.
 */
import type { NextRequest } from "next/server";
import { createSaleRequestSchema, saleResponseSchema } from "@/shared/contracts/sales";

export const requestContract = createSaleRequestSchema;
export const responseContract = saleResponseSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-SALE-001");
}
