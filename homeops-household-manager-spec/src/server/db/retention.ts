// HomeOps — retention deletes (T-PLAT-013, PRIVACY.md §3, NFR-PRIV-004).
//
// Batched so a prune never takes a long lock; counts are returned for the log line and the
// `prune_rows_deleted_total` metric. Windows come from the rows themselves (`retain_until`), which is
// how a household-configurable retention setting is honoured without a second source of truth.

import { and, lt, sql } from 'drizzle-orm';
import { activityEvent, auditLog, idempotencyKey, outboxMessage, rateLimitBucket } from './schema/platform';
import { withTransaction, type DbOrTx } from './unit-of-work';

export type RetentionCounts = {
  readonly activity: number;
  readonly audit: number;
  readonly rateLimits: number;
  readonly idempotencyKeys: number;
  readonly outbox: number;
};

const BATCH_SIZE = 1000;
/** Processed outbox rows are kept 30 days for diagnosis, then dropped (DATA_MODEL.md §2.10). */
const OUTBOX_PROCESSED_RETENTION_MS = 30 * 24 * 3_600_000;

export async function pruneExpiredRows(now: Date, batchSize = BATCH_SIZE): Promise<RetentionCounts> {
  return withTransaction(async (tx) => {
    const [activity, audit, rateLimits, idempotencyKeys, outbox] = await Promise.all([
      deleteInBatches(
        tx,
        activityEvent,
        and(lt(activityEvent.retainUntil, now)),
        activityEvent.id,
        batchSize,
      ),
      deleteInBatches(tx, auditLog, and(lt(auditLog.retainUntil, now)), auditLog.id, batchSize),
      deleteInBatches(
        tx,
        rateLimitBucket,
        lt(rateLimitBucket.expiresAt, now),
        rateLimitBucket.bucketKey,
        batchSize,
      ),
      // No surrogate id: the composite key's `client_request_id` column identifies the batch.
      deleteInBatches(
        tx,
        idempotencyKey,
        lt(idempotencyKey.expiresAt, now),
        idempotencyKey.clientRequestId,
        batchSize,
      ),
      deleteInBatches(
        tx,
        outboxMessage,
        and(
          sql`${outboxMessage.state} = 'PROCESSED'`,
          lt(outboxMessage.processedAt, new Date(now.getTime() - OUTBOX_PROCESSED_RETENTION_MS)),
        ),
        outboxMessage.id,
        batchSize,
      ),
    ]);
    return { activity, audit, rateLimits, idempotencyKeys, outbox };
  });
}

/**
 * Select-then-delete in bounded batches: `DELETE … LIMIT` is not available in Postgres, and an
 * unbounded delete on `activity_event` would hold a lock for as long as the table is large.
 */
async function deleteInBatches(
  tx: DbOrTx,
  // The table, its predicate, and the column identifying a row are passed in so every prunable table
  // uses one code path (and one reviewed lock strategy) instead of five hand-written deletes.
  table: Parameters<typeof tx.delete>[0],
  predicate: ReturnType<typeof and>,
  idColumn: unknown,
  batchSize: number,
): Promise<number> {
  const size = Math.min(Math.max(batchSize, 1), 5000);
  const rows = (await tx
    .select({ id: idColumn as never })
    .from(table)
    .where(predicate)
    .limit(size)) as { id: unknown }[];
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  const deleted = await tx
    .delete(table)
    .where(and(predicate, sql`${idColumn as never} = any(${ids})`))
    .returning({ id: idColumn as never });
  return deleted.length;
}
