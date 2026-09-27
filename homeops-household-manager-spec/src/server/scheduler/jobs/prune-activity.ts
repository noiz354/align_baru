// HomeOps — retention prune job (T-PLAT-013, PRIVACY.md §3, NFR-PRIV-004).
//
// Batched deletes, no long locks, counts logged, idempotent on re-run: a second tick after a
// successful prune simply finds nothing to delete.

import { pruneExpiredRows } from '../../db/retention';
import { logger } from '../../telemetry/logger';
import { recordMetric } from '../../telemetry/metrics';

export async function runRetentionPrune(input: {
  readonly nowInstant: string;
}): Promise<{ readonly processed: number }> {
  const now = new Date(input.nowInstant);
  const counts = await pruneExpiredRows(now);
  const total = counts.activity + counts.audit + counts.rateLimits + counts.idempotencyKeys + counts.outbox;

  // Counts only: no ids, no titles, no household names (PRIVACY.md §5).
  logger.info('retention prune', { job: 'prune-activity', outcome: 'ok', count: total });
  recordMetric('prune_rows_deleted_total', counts.activity, { table: 'activity_event' });
  recordMetric('prune_rows_deleted_total', counts.audit, { table: 'audit_log' });
  recordMetric('prune_rows_deleted_total', counts.rateLimits, { table: 'rate_limit_bucket' });
  recordMetric('prune_rows_deleted_total', counts.idempotencyKeys, { table: 'idempotency_key' });
  recordMetric('prune_rows_deleted_total', counts.outbox, { table: 'outbox_message' });

  return { processed: total };
}
