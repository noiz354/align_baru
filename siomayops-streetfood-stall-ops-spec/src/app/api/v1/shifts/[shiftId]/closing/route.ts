/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §13 — POST /shifts/{shiftId}/closing (Close Shift / Submit Daily Closing).
 * Requirements: FR-SHIFT-008/009, FR-SETTLE-001/002/010, FR-CASH-004. Task: T-CLOSE-003.
 * Offline ⇒ the closing is stored as PENDING_SYNC and stays editable until the server accepts it.
 */
import type { NextRequest } from "next/server";
import { submitClosingRequestSchema } from "@/shared/contracts/shifts";

export const requestContract = submitClosingRequestSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-CLOSE-003");
}
