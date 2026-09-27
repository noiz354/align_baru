import { z } from "zod";
import { uuidSchema, uuidV7Schema, instantSchema } from "./common";

export const syncRecordSchema = z.object({
  aggregate: z.enum(["shift", "location_report", "sale", "payment_cash", "expense", "stock_report", "incident", "closing"]),
  clientId: uuidV7Schema,
  payload: z.unknown(),
  recordedAtDevice: instantSchema,
  sequence: z.number().int().nonnegative()
});

export const syncBatchRequestSchema = z.object({
  deviceId: z.string().min(4).max(120),
  appVersion: z.string().min(1).max(40),
  records: z.array(syncRecordSchema).max(200)
});
export type SyncBatchRequest = z.infer<typeof syncBatchRequestSchema>;

export const syncRecordResultSchema = z.object({
  clientId: uuidV7Schema,
  outcome: z.enum(["ACCEPTED", "DUPLICATE", "REJECTED", "DEFERRED"]),
  serverId: uuidSchema.optional(),
  reasonCode: z.string().optional(),
  reasonMessageId: z.string().optional(),
  retryAfterSeconds: z.number().int().optional()
});
export type SyncRecordResult = z.infer<typeof syncRecordResultSchema>;
