/**
 * PHASE 0 — CONTRACT ONLY. Zod schemas describe the request/response shape of API.md and are the
 * single source of truth shared by route shells, clients and the offline queue. No handler logic
 * exists anywhere in this phase (ADR-0036).
 */
import { z } from "zod";

/** Money at the API boundary: integer minor units, never a float, never a provider decimal string. */
export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.literal("IDR")
});

/** ISO-8601 UTC instant. Business day is server-derived (ADR-0033) and never client-supplied. */
export const instantSchema = z.string().datetime({ offset: false });
export const businessDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const uuidSchema = z.string().uuid();
export const uuidV7Schema = z.string().uuid(); // UUIDv7 enforced server-side, shape-checked here

/** Canonical error envelope (API.md §0, ADR-0034). */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum([
      "VALIDATION_FAILED", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT",
      "PRECONDITION_FAILED", "RATE_LIMITED", "IDEMPOTENCY_MISMATCH", "INVALID_TRANSITION",
      "STALE_DATA", "PAYMENT_NOT_VERIFIED", "PROVIDER_UNAVAILABLE", "INTERNAL", "NOT_IMPLEMENTED"
    ]),
    message: z.string(),
    messageId: z.string().optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string(),
    retryable: z.boolean()
  })
});

/** Every mutating request carries an Idempotency-Key header (ADR-0013). */
export const idempotencyKeySchema = z.string().min(8).max(128);
