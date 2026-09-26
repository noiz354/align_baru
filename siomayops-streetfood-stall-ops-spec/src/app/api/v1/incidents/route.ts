/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §14 — POST /incidents. Requirements: FR-INC-001..005/010. Task: T-INC-001. Offline-OK.
 */
import type { NextRequest } from "next/server";
import { incidentSubmitRequestSchema } from "@/shared/contracts/incidents";

export const requestContract = incidentSubmitRequestSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-INC-001");
}
