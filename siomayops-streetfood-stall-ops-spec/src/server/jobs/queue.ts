/**
 * PHASE 0 — SKELETON ONLY. No I/O, no queries, no provider calls, no authentication.
 * Every function that would contain logic throws `Not implemented: T-XXX-XXX` (ADR-0036).
 */

/**
 * Background jobs use pg-boss on the existing PostgreSQL — no Redis, no broker (ADR-0018).
 * Jobs are enqueued inside the same transaction as the business write (outbox pattern).
 * None of these jobs may be scheduled in Phase 0.
 */
export type JobName =
  | "read-model.refresh.coverage"
  | "read-model.refresh.sales"
  | "read-model.refresh.cash-position"
  | "read-model.refresh.verification-backlog"
  | "read-model.refresh.stock-position"
  | "read-model.refresh.expense-review"
  | "read-model.refresh.closing-completeness"
  | "read-model.refresh.location-usage"
  | "alerts.evaluate"
  | "notifications.dispatch"
  | "payments.sweep.pending-verification"
  | "settlement.import.expectations"
  | "retention.execute"
  | "privacy.dsar.execute"
  | "recognition.period.compute";

export interface JobQueue {
  enqueue(name: JobName, payload: unknown, options?: { readonly startAfterSeconds?: number }): Promise<void>;
  schedule(name: JobName, cron: string): Promise<void>;
}

/** Throws. Task: T-HQ-002. */
export function createJobQueue(): JobQueue {
  throw new Error("Not implemented: T-HQ-002");
}
