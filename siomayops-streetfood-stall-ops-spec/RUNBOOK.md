# RUNBOOK

**Document ID:** DOC-RUNBOOK
**Status:** Phase 0 (plan; nothing to run yet)
**Related:** `OPERATIONS.md`, `OBSERVABILITY.md`, `SECURITY.md`, `NOTIFICATIONS.md`

> Format rule: every entry answers **symptom → impact → immediate action → diagnosis → fix →
> verify → prevention**. Infrastructure alerts must link to a section here.

---

## RB-01 — API unavailable (5xx or timeouts)

- **Symptom:** Health checks failing; operators report "tidak bisa menyimpan".
- **Impact:** Sales still possible offline; HQ data stale; nothing lost unless devices remain offline.
- **Immediate:** Confirm scope (all routes vs one). Check DB reachability, recent deploy, resource saturation.
- **Diagnosis:** Recent release? Migration half-applied? Connection pool exhausted? Disk full?
- **Fix:** Roll back to previous image if a deploy correlates; else restore DB connectivity; scale replicas.
- **Verify:** Health endpoint green; a synthetic sale create succeeds; sync backlog drains.
- **Prevention:** Canary deploys, readiness gates, connection pool alarms, migration rehearsal.

## RB-02 — Database unavailable / failover

- **Symptom:** Writes fail; reads fail; jobs stop.
- **Impact:** No new records accepted; devices queue locally (safe); HQ stale.
- **Immediate:** Trigger managed failover; put the app into "writes paused" mode if it is not automatic.
- **Diagnosis:** Provider incident? Failover trigger? Replication lag on the promoted node?
- **Fix:** Promote replica; verify connection routing; resume app.
- **Verify:** Sample queries; a test sale create and closing; job worker resumes.
- **Prevention:** Monitor replication lag; quarterly restore drill; write-path backpressure.

## RB-03 — Payment callback failures / signature failures

- **Symptom:** Alert `siomay.payments.callback_failed`; payments stuck PENDING.
- **Impact:** Unverified digital money; operators see "Menunggu verifikasi" correctly (no false success).
- **Immediate:** Check provider status page; verify our secret/key rotation state; confirm clock skew.
- **Diagnosis:** Signature mismatch (wrong secret or scheme change), IP allowlist, payload format change.
- **Fix:** Correct configuration; provider re-sends or we query status and reconcile manually.
- **Verify:** A test callback verifies; backlog drains; reconciliation queue shrinks.
- **Prevention:** Provider contract tests; secret rotation runbook; alerting on any signature failure.

## RB-04 — Duplicate or mismatched payment detected

- **Symptom:** Alert on duplicates/mismatch; Finance reports a suspicious deposit.
- **Impact:** Potential double counting or unverified money.
- **Immediate:** Freeze reconciliation for the affected references; do **not** edit payments by hand.
- **Diagnosis:** Compare callbacks, provider references, amounts, timestamps.
- **Fix:** Record a manual reconciliation with evidence and reason; correct forward only.
- **Verify:** Totals reconcile; audit entries present; no sales rewritten.
- **Prevention:** Idempotency tests; dedupe unique indexes; amount/currency checks.

## RB-05 — Sync backlog or mass rejection

- **Symptom:** Many devices with queued records; `sync.records_rejected` spike.
- **Impact:** HQ data incomplete; operators see unsynced counts (honest UI).
- **Immediate:** Identify the rejection reason (usually a schema/validation change or a price/state conflict).
- **Diagnosis:** Inspect sample rejected payloads; check recent deploy for contract changes.
- **Fix:** Fix server-side handling or provide a device-side workaround; never delete queue entries.
- **Verify:** Backlog drains; accepted counts match device counts.
- **Prevention:** Contract tests between client and server; staged contract changes; versioned payloads.

## RB-06 — Corrupted offline queue on a device

- **Symptom:** Support report: "data saya hilang" / stalled queue.
- **Impact:** That device's unsynced records at risk; other devices unaffected.
- **Immediate:** Instruct the operator **not** to clear app data; take a quarantine export.
- **Diagnosis:** Inspect quarantined records; determine which are recoverable.
- **Fix:** Re-insert recovered records via the supported sync path (never by direct SQL with fabricated IDs).
- **Verify:** Shift totals match the operator's paper record; audit notes the recovery.
- **Prevention:** Stronger validation, quarantine UX, device storage monitoring.

## RB-07 — Cash variance spike / pattern

- **Symptom:** `CASH_VARIANCE` alerts clustering (area, location, or shift type).
- **Impact:** Possible process issue, training gap, or theft — unknown until investigated.
- **Immediate:** Review the cluster with Finance; do **not** contact operators with accusations.
- **Diagnosis:** Compare locations, float handling, expense reporting, recount habits.
- **Fix:** Training/process fix, tolerance recalibration, or escalation to a human investigation process.
- **Verify:** Variance distribution returns to baseline.
- **Prevention:** Float discipline coaching; recount prompts; tolerance review.

## RB-08 — Suspected coercion or unlawful payment demand reported

- **Symptom:** Repeated `UNVERIFIED_FIELD_EXPENSE`, incidents of `FORCED_RELOCATION`, operator distress.
- **Impact:** Operator safety and welfare — **business-human process, not an automated one**.
- **Immediate:** Route per policy to the human escalation owner; ensure the operator is safe.
- **Diagnosis:** Aggregate pattern review (location, timing, category) — **no naming of parties, no conclusions**.
- **Fix:** Business response (relocation, supervision, legal advice if appropriate) — outside the app.
- **Verify:** Operator reports reduced incidents; no pressure recorded.
- **Prevention:** Operator-protective reporting UX; leadership stance; policy training.
- **Hard rule:** the platform never automates this, never suggests amounts, never identifies recipients.

## RB-09 — Data breach or suspected exposure

- **Symptom:** Anomalous admin access, leaked credential, unusual export, provider notice.
- **Impact:** Potential personal-data exposure; UU PDP obligations.
- **Immediate:** Contain: revoke sessions/keys, isolate affected accounts, preserve logs.
- **Diagnosis:** Determine data categories and subjects affected.
- **Fix:** Patch, rotate secrets, correct access.
- **Verify:** No continued exfiltration; controls verified.
- **Notify:** If personal data affected, notify data subjects and the authority within **72 hours**
  (UU PDP Art. 46); document the assessment either way.
- **Prevention:** Access reviews, least privilege, monitoring, secret rotation.

## RB-10 — Retention job failure

- **Symptom:** Job error; no retention log entry.
- **Impact:** Data retained longer than policy — a compliance defect, not a crash.
- **Immediate:** Identify the failing handler scope; confirm no partial over-deletion.
- **Diagnosis:** Constraint conflict (legal hold), storage error, timeout on large batch.
- **Fix:** Repair, re-run with bounds, verify counts.
- **Verify:** Log shows expected counts; spot-check that scheduled deletions occurred.
- **Prevention:** Dry-run mode, batch bounds, alerting on failure (silence is the bug).

## RB-11 — Dead-letter job queue growth

- **Symptom:** `jobs.dead_letter` counter rising; queue age increasing.
- **Impact:** Notifications, read models, or sweeps delayed.
- **Immediate:** Identify the job and failure signature; check for a poison payload.
- **Diagnosis:** Recent code change, provider outage, malformed data.
- **Fix:** Patch handler, requeue safely (idempotent), or drop with documentation.
- **Verify:** Queue depth normal; no duplicate side effects (idempotency protects).
- **Prevention:** Contract tests, poison-message isolation, alert thresholds.

## RB-12 — Stale HQ data (read model lag)

- **Symptom:** Freshness badges red; cards show "data not ready".
- **Impact:** HQ decisions delayed; no money risk.
- **Immediate:** Confirm job health and DB load; trigger a manual rebuild if safe.
- **Diagnosis:** Job failure, slow aggregation, lock contention.
- **Fix:** Fix the job, rebuild idempotently.
- **Verify:** Watermarks advance; card freshness green.
- **Prevention:** Rebuild determinism tests; job alerts; index review.

## RB-13 — Device loss / operator phone change mid-shift

- **Symptom:** Operator cannot continue on the same device.
- **Impact:** Shift continuity at risk (unsynced records on the lost device).
- **Immediate:** Ask the operator to sync (if possible) before wiping; then log in on the new device.
- **Diagnosis:** Determine which records are server-accepted vs device-only.
- **Fix:** Reconstruct missing records with the operator present; supervisor confirms; audit the reconstruction.
- **Verify:** Closing reconciles with the cash in hand.
- **Prevention:** Sync-first transfer flow; frequent opportunistic sync; support checklist.

## RB-14 — Secret rotation (scheduled or emergency)

- **Steps:** Create new secret → deploy config referencing it (dual-valid where possible) → verify →
  revoke old → confirm no callback/signature failures → record rotation in the log.
- **Emergency (leak):** rotate immediately, revoke tokens/sessions, review access logs, assess breach.

## RB-15 — Provider onboarding / offboarding (payment, WhatsApp, maps)

- **Onboarding:** Contract/terms review → credentials in secret manager → sandbox verification →
  adapter contract tests → staged enablement behind a flag → monitor.
- **Offboarding:** Disable flag → drain pending items → archive raw payloads per retention →
  remove credentials → update `PRIVACY.md` vendor register.
