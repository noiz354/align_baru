import { z } from "zod";
import { uuidSchema, uuidV7Schema } from "./common";

export const loyaltyIdentifyRequestSchema = z.object({
  method: z.enum(["PHONE_HASH", "ROTATING_QR_TOKEN", "ANONYMOUS_DEVICE_TOKEN"]),
  value: z.string().min(4).max(200),
  consentGiven: z.boolean(),
  consentTextVersion: z.string().min(1).max(40),
  clientRequestId: uuidV7Schema.optional()
});

export const rewardRedeemRequestSchema = z.object({
  rewardInstanceId: uuidSchema.optional(),
  saleId: uuidSchema,
  clientRedeemId: uuidV7Schema.optional()
});
