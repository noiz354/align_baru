/**
 * Job queue port (pg-boss in production; nothing above this file knows that).
 *
 * Where this belongs: server/jobs. ADR-0010 chose pg-boss (Postgres `SKIP LOCKED`, transactional
 * enqueue, retries, DLQ, cron) over Redis/BullMQ and Kafka - "domain events do not require a broker".
 * Specification: ADR-0010/0015, docs/architecture/FAILURE-MODEL.md §4, TASKS.md T-ARCH-005.
 * Invariants:
 *   1. Enqueue can happen inside the same transaction as the state change (outbox pattern) - this is
 *      why a Postgres-backed queue was chosen.
 *   2. Every job is idempotent; duplicate execution is expected (C11).
 *   3. Dead-lettered jobs are visible to an operator and are replayed deliberately, never automatically.
 *   4. Job payloads contain ids and counts only - never content, never tokens.
 * Task ownership: T-ARCH-005, T-ARCH-006.
 */
export type QueueName = "ASSEMBLY" | "MEDIA" | "TRANSCRIPTION" | "NOTIFY" | "RETENTION" | "RECONCILE";

export interface JobOptions {
  readonly singletonKey?: string;      // prevents duplicate concurrent work (assembly per session)
  readonly retryLimit?: number;
  readonly startAfterSeconds?: number;
  readonly deadLetterAfterDays?: number;
  readonly idempotencyKey?: string;
}

export interface QueuePort {
  enqueue(queue: QueueName, payload: Readonly<Record<string, string | number | boolean>>, options?: JobOptions): Promise<{ jobId: string }>;
  /** Worker registration; the handler MUST be idempotent. */
  work(queue: QueueName, handler: (job: { readonly jobId: string; readonly attempt: number; readonly payload: Readonly<Record<string, unknown>> }) => Promise<void>): Promise<void>;
}

/** @throws Error("Not implemented: T-ARCH-005") */
export function queue(): QueuePort {
  throw new Error("Not implemented: T-ARCH-005");
}
