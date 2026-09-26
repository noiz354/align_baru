/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/**
 * API.md §15/§16 — identify customer, redeem reward.
 * Requirements: FR-LOYALTY-001..012. Identification requires consent; redemption is single-use.
 */
export const loyaltyIdentifyRequestSchema = z.object({
  method: z.enum(["PHONE_HASH", "ROTATING_QR_TOKEN", "ANONYMOUS_DEVICE_TOKEN"]),
  value: z.string().min(4).max(200),
  consentGiven: z.boolean(),
  consentTextVersion: z.string().min(1).max(40),
  clientRequestId: uuidV7Schema
});

export const rewardRedeemRequestSchema = z.object({
  rewardInstanceId: uuidSchema,
  saleId: uuidSchema,
  clientRedeemId: uuidV7Schema
});
