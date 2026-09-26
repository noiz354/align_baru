/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §2 — POST /shifts/{shiftId}/location-reports (Select Location).
 * Requirements: FR-LOCATION-004/005/007. Task: T-LOC-004. Offline-OK; explicit operator action only.
 */
import type { NextRequest } from "next/server";
import { locationReportRequestSchema } from "@/shared/contracts/locations";

export const requestContract = locationReportRequestSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ shiftId: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-LOC-004");
}
