/**
 * Audit verification job - the periodic sweep that turns tamper evidence into an alert.
 *
 * Where this belongs: server/audit, next to the writer and the verifier it drives.
 * Specification: SECURITY.md §9, TASKS.md T-SEC-007 ("verification job detects any break"),
 *   FR-AUDIT-002, NFR-OPS-002.
 *
 * What it does: walks every organization partition (or the ones named by the caller) and verifies each
 * chain. A break is a RESULT, not an exception - the sweep must finish and report every broken tenant,
 * because "one chain broke" and "the audit store is unreadable" lead to different incidents. A storage
 * failure still throws: a sweep that silently reports nothing verified is worse than no sweep.
 *
 * Cost: one ordered read per organization, O(rows). Partitions are independent, so a sweep can be
 * chunked by the caller (`organizationIds`) to keep each run inside a maintenance window.
 *
 * Failure cases: no organizations -> `{ checked: 0, broken: [] }` · unreadable table -> throws.
 *
 * Task ownership: T-SEC-007 delivered the job BODY and its test. The schedule itself - whatever wakes
 * this function on a timer and pages a human on a non-empty `broken` list - is not wired here: the
 * delivered stack has no scheduler (STACK-2026 §5 rejected Redis/BullMQ; there is no cron service in
 * `ops/` yet). It is owned by T-OPS-002 (containerised stack) and must not be claimed as done until the
 * trigger exists.
 */
import { asc } from "drizzle-orm";
import { organizations } from "@/server/db/schema";
import { getDb, type DbHandle } from "@/server/db/client";
import { verifyAuditChain, type AuditChainReport } from "@/server/audit/verify";

export interface AuditVerificationSummary {
  /** Number of organization partitions examined. */
  readonly checked: number;
  /** One report per broken chain, in organization order. Empty means every chain verified. */
  readonly broken: readonly AuditChainReport[];
}

export interface AuditVerificationOptions {
  /** Restrict the sweep to these organizations; defaults to every organization in the database. */
  readonly organizationIds?: readonly string[];
}

/**
 * Verifies every organization's audit chain.
 *
 * @throws Error when the audit store cannot be read - never returns a clean summary it did not earn
 */
export async function runAuditVerification(
  handle?: DbHandle,
  options: AuditVerificationOptions = {},
): Promise<AuditVerificationSummary> {
  const db = handle ?? getDb();
  const ids =
    options.organizationIds ??
    (await db.select({ id: organizations.id }).from(organizations).orderBy(asc(organizations.id))).map(
      (row) => row.id,
    );

  const broken: AuditChainReport[] = [];
  for (const organizationId of ids) {
    const report = await verifyAuditChain(db, organizationId);
    if (!report.ok) broken.push(report);
  }

  return { checked: ids.length, broken };
}
