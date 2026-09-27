// HomeOps — platform adapters (T-PLAT-012, T-PLAT-025, docs/api/CONVENTIONS.md §5, SECURITY.md §8).
//
// Contracts live in `src/shared/contracts/*` so the feature layer can depend on them without
// importing `src/server/db` (a forbidden edge, MODULE-MAP.md §4).

import { createHash } from 'node:crypto';
import { and, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import type { Id } from '../../../shared/types';
import type { IdempotencyBeginResult, IdempotencyStore } from '../../../shared/contracts/idempotency';
import type { OutboxMessageValue, OutboxStore } from '../../../shared/contracts/outbox';
import {
  RATE_LIMIT_CLASSES,
  type RateLimitDecision,
  type RateLimitStore,
} from '../../../shared/contracts/rate-limit';
import { idempotencyKey, outboxMessage, rateLimitBucket, schedulerJobRun } from '../schema/platform';
import type { DbOrTx } from '../unit-of-work';

/* ------------------------------------------- rate limits -------------------------------------- */

export function createRateLimitStore(db: DbOrTx): RateLimitStore {
  return {
    async consume({ cls, scope, now }): Promise<RateLimitDecision> {
      const config = RATE_LIMIT_CLASSES[cls];
      const windowMs = config.windowSeconds * 1000;
      const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
      const windowStart = new Date(windowStartMs);
      const windowEnd = new Date(windowStartMs + windowMs);
      const bucketKey = hashKey(cls, scope, windowStart);

      const rows = await db
        .insert(rateLimitBucket)
        .values({ bucketKey, windowStart, count: 1, expiresAt: windowEnd })
        .onConflictDoUpdate({
          target: rateLimitBucket.bucketKey,
          set: { count: sql`${rateLimitBucket.count} + 1` },
        })
        .returning({ count: rateLimitBucket.count });

      const count = rows[0]?.count ?? 1;
      const allowed = count <= config.limit;
      const remaining = Math.max(0, config.limit - count);
      if (allowed) return { allowed, remaining };
      // Fixed windows: the retry-after is the end of the current window (DECISIONS.md 2026-09-27).
      return {
        allowed,
        remaining,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000)),
      };
    },

    async peek({ cls, scope, now }): Promise<RateLimitDecision> {
      const config = RATE_LIMIT_CLASSES[cls];
      const windowMs = config.windowSeconds * 1000;
      const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
      const rows = await db
        .select({ count: rateLimitBucket.count })
        .from(rateLimitBucket)
        .where(eq(rateLimitBucket.bucketKey, hashKey(cls, scope, windowStart)))
        .limit(1);
      const count = rows[0]?.count ?? 0;
      const allowed = count < config.limit;
      if (allowed) return { allowed, remaining: config.limit - count };
      const windowEnd = windowStart.getTime() + windowMs;
      return {
        allowed,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
      };
    },

    async pruneExpired(now: Date): Promise<number> {
      const rows = await db
        .delete(rateLimitBucket)
        .where(lt(rateLimitBucket.expiresAt, now))
        .returning({ key: rateLimitBucket.bucketKey });
      return rows.length;
    },
  };
}

/** Keys are hashed: an email, IP, or member id is never stored in the bucket table (PRIVACY.md §5). */
function hashKey(cls: string, scope: string, windowStart: Date): string {
  return createHash('sha256').update(`${cls}|${scope}|${windowStart.toISOString()}`).digest('hex');
}

/* ------------------------------------------- idempotency -------------------------------------- */

export function createIdempotencyStore(db: DbOrTx): IdempotencyStore {
  return {
    async begin({ householdId, clientRequestId, operation, now }): Promise<IdempotencyBeginResult> {
      const inserted = await db
        .insert(idempotencyKey)
        .values({
          householdId,
          clientRequestId,
          operation,
          status: 'IN_FLIGHT',
          createdAt: now,
          // 24 h (docs/api/CONVENTIONS.md §5).
          expiresAt: new Date(now.getTime() + 24 * 3_600_000),
        })
        .onConflictDoNothing({
          target: [idempotencyKey.householdId, idempotencyKey.clientRequestId, idempotencyKey.operation],
        })
        .returning({ status: idempotencyKey.status });

      if (inserted.length > 0) return { status: 'NEW' };

      const existing = await db
        .select({
          status: idempotencyKey.status,
          entityKind: idempotencyKey.entityKind,
          entityId: idempotencyKey.entityId,
        })
        .from(idempotencyKey)
        .where(
          and(
            eq(idempotencyKey.householdId, householdId),
            eq(idempotencyKey.clientRequestId, clientRequestId),
            eq(idempotencyKey.operation, operation),
          ),
        )
        .limit(1);
      const row = existing[0];
      if (!row) return { status: 'NEW' };
      if (row.status === 'COMMITTED') {
        return {
          status: 'REPLAY',
          entityKind: row.entityKind,
          entityId: (row.entityId ?? null) as Id | null,
        };
      }
      return { status: 'IN_FLIGHT' };
    },

    async commit({
      householdId,
      clientRequestId,
      operation,
      entityKind,
      entityId,
      expiresAt,
    }): Promise<void> {
      await db
        .update(idempotencyKey)
        .set({ status: 'COMMITTED', entityKind, entityId, expiresAt })
        .where(
          and(
            eq(idempotencyKey.householdId, householdId),
            eq(idempotencyKey.clientRequestId, clientRequestId),
            eq(idempotencyKey.operation, operation),
          ),
        );
    },

    async pruneExpired(now: Date): Promise<number> {
      const rows = await db
        .delete(idempotencyKey)
        .where(lt(idempotencyKey.expiresAt, now))
        .returning({ key: idempotencyKey.operation });
      return rows.length;
    },
  };
}

/* ---------------------------------------------- outbox ---------------------------------------- */

export function createOutboxStore(db: DbOrTx): OutboxStore {
  return {
    async enqueue(message) {
      await db
        .insert(outboxMessage)
        .values({
          id: message.id,
          householdId: message.householdId,
          dedupeKey: message.dedupeKey,
          topic: message.topic,
          payload: message.payload,
          state: 'PENDING',
          attempts: 0,
          nextAttemptAt: message.nextAttemptAt,
        })
        // A retried transaction re-enqueues the same dedupe key: that is a no-op, not a duplicate
        // delivery (I-XA-007, DATA_MODEL.md §2.10).
        .onConflictDoNothing({ target: outboxMessage.dedupeKey });
    },

    async claimDue({ now, limit }) {
      const rows = await db
        .select()
        .from(outboxMessage)
        .where(and(eq(outboxMessage.state, 'PENDING'), lte(outboxMessage.nextAttemptAt, now)))
        .orderBy(outboxMessage.nextAttemptAt)
        .limit(Math.min(Math.max(limit, 1), 200))
        // Two instances draining at once must not deliver the same message twice (FINAL-REVIEW §4).
        .for('update', { skipLocked: true });
      if (rows.length === 0) return [];
      const ids = rows.map((row) => row.id);
      await db
        .update(outboxMessage)
        .set({ state: 'PROCESSING', attempts: sql`${outboxMessage.attempts} + 1` })
        .where(inArray(outboxMessage.id, ids));
      // The selected rows predate the UPDATE. Return the claimed state/attempt
      // count so the worker's retry policy uses the persisted attempt number.
      return rows.map((row) => toOutboxValue({ ...row, state: 'PROCESSING', attempts: row.attempts + 1 }));
    },

    async markProcessed(id, now) {
      await db
        .update(outboxMessage)
        .set({ state: 'PROCESSED', processedAt: now })
        .where(eq(outboxMessage.id, id));
    },

    async markFailed({ id, now, errorClass, retryInMs }) {
      await db
        .update(outboxMessage)
        .set({
          state: 'PENDING',
          lastErrorClass: errorClass,
          nextAttemptAt: new Date(now.getTime() + retryInMs),
        })
        .where(eq(outboxMessage.id, id));
    },

    async markDead({ id, now, errorClass }) {
      await db
        .update(outboxMessage)
        .set({ state: 'DEAD', lastErrorClass: errorClass, processedAt: now })
        .where(eq(outboxMessage.id, id));
    },

    async counts() {
      const rows = await db
        .select({
          pending: sql<number>`count(*) filter (where ${outboxMessage.state} in ('PENDING','PROCESSING'))::int`,
          dead: sql<number>`count(*) filter (where ${outboxMessage.state} = 'DEAD')::int`,
        })
        .from(outboxMessage);
      return { pending: rows[0]?.pending ?? 0, dead: rows[0]?.dead ?? 0 };
    },

    async pruneProcessed(olderThan) {
      const rows = await db
        .delete(outboxMessage)
        .where(and(eq(outboxMessage.state, 'PROCESSED'), lt(outboxMessage.processedAt, olderThan)))
        .returning({ id: outboxMessage.id });
      return rows.length;
    },
  };
}

/* ----------------------------------------- scheduler runs ------------------------------------- */

export type SchedulerRunStore = {
  get(job: string): Promise<SchedulerRunSnapshot | null>;
  all(): Promise<readonly SchedulerRunSnapshot[]>;
  recordStarted(job: string, now: Date): Promise<void>;
  recordSucceeded(
    job: string,
    input: { readonly now: Date; readonly durationMs: number; readonly processed: number },
  ): Promise<void>;
  recordFailed(
    job: string,
    input: { readonly now: Date; readonly durationMs: number; readonly errorClass: string },
  ): Promise<void>;
};

export type SchedulerRunSnapshot = {
  readonly job: string;
  readonly lastStartedAt: string | null;
  readonly lastSucceededAt: string | null;
  readonly lastFailedAt: string | null;
  readonly consecutiveFailures: number;
  readonly lastDurationMs: number | null;
  readonly lastProcessedCount: number | null;
};

export function createSchedulerRunStore(db: DbOrTx): SchedulerRunStore {
  return {
    async get(job) {
      const rows = await db.select().from(schedulerJobRun).where(eq(schedulerJobRun.job, job)).limit(1);
      const row = rows[0];
      return row ? toRunSnapshot(row) : null;
    },
    async all() {
      const rows = await db.select().from(schedulerJobRun);
      return rows.map(toRunSnapshot);
    },
    async recordStarted(job, now) {
      await db
        .insert(schedulerJobRun)
        .values({ job, lastStartedAt: now })
        .onConflictDoUpdate({ target: schedulerJobRun.job, set: { lastStartedAt: now } });
    },
    async recordSucceeded(job, { now, durationMs, processed }) {
      await db
        .insert(schedulerJobRun)
        .values({
          job,
          lastStartedAt: now,
          lastSucceededAt: now,
          lastDurationMs: durationMs,
          lastProcessedCount: processed,
          consecutiveFailures: 0,
        })
        .onConflictDoUpdate({
          target: schedulerJobRun.job,
          set: {
            lastSucceededAt: now,
            lastDurationMs: durationMs,
            lastProcessedCount: processed,
            consecutiveFailures: 0,
            lastErrorClass: null,
          },
        });
    },
    async recordFailed(job, { now, durationMs, errorClass }) {
      await db
        .insert(schedulerJobRun)
        .values({
          job,
          lastStartedAt: now,
          lastFailedAt: now,
          lastDurationMs: durationMs,
          lastErrorClass: errorClass,
          consecutiveFailures: 1,
        })
        .onConflictDoUpdate({
          target: schedulerJobRun.job,
          set: {
            lastFailedAt: now,
            lastDurationMs: durationMs,
            lastErrorClass: errorClass,
            consecutiveFailures: sql`${schedulerJobRun.consecutiveFailures} + 1`,
          },
        });
    },
  };
}

function toRunSnapshot(row: typeof schedulerJobRun.$inferSelect): SchedulerRunSnapshot {
  return {
    job: row.job,
    lastStartedAt: row.lastStartedAt?.toISOString() ?? null,
    lastSucceededAt: row.lastSucceededAt?.toISOString() ?? null,
    lastFailedAt: row.lastFailedAt?.toISOString() ?? null,
    consecutiveFailures: row.consecutiveFailures,
    lastDurationMs: row.lastDurationMs,
    lastProcessedCount: row.lastProcessedCount,
  };
}

function toOutboxValue(row: typeof outboxMessage.$inferSelect): OutboxMessageValue {
  return {
    id: row.id as Id,
    householdId: (row.householdId ?? null) as Id | null,
    dedupeKey: row.dedupeKey,
    topic: row.topic as OutboxMessageValue['topic'],
    payload: row.payload as Readonly<Record<string, string | number>>,
    state: row.state,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
  };
}
