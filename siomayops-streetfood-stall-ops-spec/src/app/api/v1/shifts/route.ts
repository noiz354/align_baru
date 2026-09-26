/**
 * API.md §1 — POST /shifts (Start Shift). Requirements: FR-SHIFT-001/003/007. Task: T-SHIFT-001.
 * PHASE 0 ROUTE SHELL: the contract binding is declared, the handler refuses to run (ADR-0036).
 */
import type { NextRequest } from "next/server";
import { startShiftRequestSchema, startShiftResponseSchema } from "@/shared/contracts/shifts";

export const requestContract = startShiftRequestSchema;
export const responseContract = startShiftResponseSchema;

export async function POST(_request: NextRequest): Promise<Response> {
  throw new Error("Not implemented: T-SHIFT-001");
}
