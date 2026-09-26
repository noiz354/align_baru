/**
 * Retention job - the mechanism that makes the retention promises real (R1…R28).
 *
 * Where this belongs: server/jobs (scheduler) with per-policy implementations; the policy table lives
 * with the configuration (RETENTION_*_DAYS).
 * Specification: RETENTION.md, PRIVACY.md §6, TASKS.md T-PRIV-003 / T-FEEDBACK-008, RUNBOOK RB-12.
 * Invariants:
 *   1. Dry-run first; a policy is only enabled after its dry-run counts are reviewed.
 *   2. Idempotent and batched (RETENTION_BATCH_SIZE); no long transactions (C12).
 *   3. Dependency protection: never delete a row that live content references; a refusal is correct
 *      behaviour and is reported.
 *   4. Aggregate before delete where required (attendance -> counts; feedback -> aggregates).
 *   5. Every run writes an evidence record with counts only - never the deleted content.
 *   6. A legal hold suspends deletion for the affected scope and says so.
 * Task ownership: T-PRIV-003, T-FEEDBACK-008, T-OPS-006.
 */
export interface RetentionPolicy {
  readonly key: string;                 // e.g. "registration", "attendance", "token", "audio_master"
  readonly dataClass: string;
  readonly retentionDays: number;
  readonly aggregateBeforeDelete: boolean;
  readonly dependencyProtected: boolean;
}

export interface RetentionRunResult {
  readonly policyKey: string;
  readonly dryRun: boolean;
  readonly candidates: number;
  readonly deleted: number;
  readonly blockedByDependency: number;
  readonly evidenceRecordId: string;
}

/** @throws Error("Not implemented: T-PRIV-003") */
export async function runRetentionPolicy(policy: RetentionPolicy, options: { readonly dryRun: boolean }): Promise<RetentionRunResult> {
  throw new Error("Not implemented: T-PRIV-003");
}
