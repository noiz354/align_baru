/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * OFFLINE.md §sync / ARCHITECTURE.md §6.2 — POST /api/v1/sync/batches.
 * Requirements: NFR-OFFLINE-003..007, FR-SALE-011. Task: T-OFF-001.
 * Per-record results; per-aggregate FIFO enforced client-side; no silent drops; a digital payment
 * can never arrive here as PAID (ADR-0033).
 */
import type { NextRequest } from "next/server";
import { syncBatchRequestSchema } from "@/shared/contracts/sync";

export const requestContract = syncBatchRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-OFF-001");
}
