/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/**
 * OFFLINE.md §sync — POST /api/v1/sync/batches. Task: T-OFF-001.
 * Per-aggregate ordering, per-record results, no silent drops (NFR-OFFLINE-003..007).
 */
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
