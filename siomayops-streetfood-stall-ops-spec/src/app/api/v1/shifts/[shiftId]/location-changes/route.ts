/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §3 — POST /shifts/{shiftId}/location-changes (Change Location / move).
 * Requirements: FR-LOCATION-007. Task: T-LOC-005. History is closed, never rewritten.
 */
import type { NextRequest } from "next/server";
import { locationReportRequestSchema } from "@/shared/contracts/locations";

export const requestContract = locationReportRequestSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-LOC-005");
}
