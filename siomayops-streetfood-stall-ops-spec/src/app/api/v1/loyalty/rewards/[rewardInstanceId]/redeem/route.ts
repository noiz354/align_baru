/** PHASE 0 — see ADR-0036: skeleton only, no logic, no I/O. */
/**
 * API.md §16 — POST /loyalty/rewards/{rewardInstanceId}/redeem.
 * Requirements: FR-LOYALTY-006, INV-06. Task: T-LOY-003. Single-use; online by default.
 */
import type { NextRequest } from "next/server";
import { rewardRedeemRequestSchema } from "@/shared/contracts/loyalty";

export const requestContract = rewardRedeemRequestSchema;

export async function POST(_request: NextRequest, _ctx: { params: Promise<{ rewardInstanceId: string }> }): Promise<Response> {
  throw new Error("Not implemented: T-LOY-003");
}
