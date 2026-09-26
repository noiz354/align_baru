/**
 * Job registry - one place that names every queue, job type, schedule and idempotency key.
 *
 * Where this belongs: server/jobs (worker start-up).
 * Specification: OPERATIONS.md §4 (routine job supervision), docs/architecture/FAILURE-MODEL.md §4,
 *   TASKS.md T-ARCH-005.
 * Invariants: every job is safe to run twice; schedules are timezone-aware (venue-local for
 *   participant-visible jobs like retention at 02:00); a job records its run (start, end, counts,
 *   outcome); a missing handler in an environment fails startup loudly rather than silently dropping work.
 * Task ownership: T-ARCH-005, T-OPS-002 (worker container health).
 */
export interface JobDefinition {
  readonly name: string;
  readonly queue: import("./queue.port").QueueName;
  readonly schedule?: string;          // cron, in the documented timezone
  readonly timeoutSeconds: number;
  readonly retryLimit: number;
  readonly convergenceNote: string;    // how the job converges if re-run
}

export const JOBS: readonly JobDefinition[] = [
  { name: "assembly.run", queue: "ASSEMBLY", timeoutSeconds: 900, retryLimit: 3, convergenceNote: "attempt keyed; newest attempt marked current (C11)" },
  { name: "processing.run", queue: "MEDIA", timeoutSeconds: 3600, retryLimit: 3, convergenceNote: "reads the master only; re-run produces a new version" },
  { name: "transcription.submit", queue: "TRANSCRIPTION", timeoutSeconds: 120, retryLimit: 3, convergenceNote: "providerJobId recorded; duplicate submit is detected" },
  { name: "transcription.poll", queue: "TRANSCRIPTION", schedule: "* * * * *", timeoutSeconds: 60, retryLimit: 3, convergenceNote: "idempotent by (providerJobId, event) — C9" },
  { name: "notification.dispatch", queue: "NOTIFY", timeoutSeconds: 60, retryLimit: 5, convergenceNote: "UNIQUE(dedupe_key) — C10" },
  { name: "attendance.reconcile", queue: "RECONCILE", schedule: "0 * * * *", timeoutSeconds: 300, retryLimit: 2, convergenceNote: "read-only; drift must be zero" },
  { name: "retention.run", queue: "RETENTION", schedule: "0 2 * * *", timeoutSeconds: 1800, retryLimit: 2, convergenceNote: "batched, dry-run capable, idempotent per policy" },
  { name: "export.cleanup", queue: "RETENTION", schedule: "30 2 * * *", timeoutSeconds: 300, retryLimit: 2, convergenceNote: "deletes expired exports; count verification" },
  { name: "token.expiry", queue: "RECONCILE", schedule: "15 2 * * *", timeoutSeconds: 300, retryLimit: 2, convergenceNote: "marks expired tokens" },
  { name: "backup.verify", queue: "RECONCILE", schedule: "0 3 * * *", timeoutSeconds: 600, retryLimit: 2, convergenceNote: "alerts when the newest backup is stale" },
];
