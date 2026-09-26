# OPERATIONS

**Document ID:** DOC-OPERATIONS
**Status:** Phase 0 (run-the-service plan; **no service running**)
**Related:** `DEPLOYMENT.md`, `RUNBOOK.md`, `OBSERVABILITY.md`, `RETENTION.md`

---

## 1. Operating model

| Aspect | Decision |
| --- | --- |
| Team size assumption | 1–2 engineers + product owner + part-time ops/field support |
| On-call | Best-effort, alert-driven; no 24/7 rota in the pilot (alerts route to business roles first) |
| Support hours (pilot) | 07:00–20:00 Asia/Jakarta, matching selling hours |
| Escalation | Business-first (Ops Supervisor → HQ Ops → Owner); engineering engaged for technical faults |
| Change windows | Deploys outside 17:00–19:00 closing wave except for S1 fixes |
| Communication | One internal channel + in-app operational notices |

---

## 2. Daily operational rhythm (engineering + support)

| Time | Activity | Owner |
| --- | --- | --- |
| 06:45 | Morning health check: API, DB, jobs, sync backlog, overnight alerts | Support/Eng |
| 07:00–09:00 | Shift-start window watch: shift/start failures, location reporting | Support |
| 09:00 | Triage alerts and dead letters; process any quarantined queue reports | Eng |
| 12:00 | Midday check: stock alerts, incident queue, payment pending ages | Ops + Eng |
| 15:00 | Provider callback health, reconciliation backlog | Eng + Finance |
| 17:00–19:00 | Closing wave watch: closing failures, variance spikes, sync failures | Support |
| 20:00 | Day roll-up verification; retention job results; daily summary note | Eng |
| Weekly | Cost per stall, error budget, alert quality review, dependency check | Eng + Owner |
| Monthly | Retention job evidence, restore drill check, ADR review, license review | Eng + Owner |
| Quarterly | Full restore drill, privacy review, methodology review (performance/recognition) | All |

---

## 3. Service level objectives (operational)

| SLI | Target | Measurement |
| --- | --- | --- |
| API availability | 99.5% monthly | Non-5xx rate |
| Sale creation p95 (server) | ≤ 800 ms | Histogram on the route |
| Sync batch success | ≥ 99.5% | Batch results aggregate |
| Payment callback handling | ≥ 99.9% within 60 s | Provider callback trace/metric |
| Job success | ≥ 99.5% (excluding dead letters pending triage) | pg-boss metrics |
| HQ card freshness | ≤ 5 min p95 | Read-model watermark age |
| Alert acknowledgement (P1) | ≤ 30 min during support hours | Alert timestamps |

Error-budget policy: if a month burns > 50% of the budget on a component, feature work on that
component pauses in favour of reliability work.

---

## 4. Routine procedures

| Procedure | Cadence | Notes |
| --- | --- | --- |
| Backup verification | Daily (automated check) + quarterly restore drill | Restore drill restores into a scratch instance and reconciles sample data |
| Retention job review | Weekly | Confirm job ran; review counts; investigate skips/failures |
| Dead-letter triage | Daily | Each dead letter: fix, requeue, or document as expected |
| Sync backlog review | Daily | Identify devices/stalls with persistent queue depth; support outreach |
| Quarantine inbox | Weekly | Follow up on corrupted-queue reports; improve validation |
| Dependency upgrades | Monthly (+72 h for critical CVEs) | Full test suite as the gate |
| Secret rotation | Per policy + on any suspicion | Documented in `RUNBOOK.md` |
| Access review | Quarterly | Who has production access; remove stale accounts |
| Data-subject requests | Within documented SLA | Logged; executed with tooling (`T-OPS-001`) |
| Privacy/DPIA review | Before each new personal-data feature | `PRIVACY.md` §8 |
| Cost review | Monthly | Cost per active stall; anomaly investigation |

---

## 5. Capacity and scaling

| Signal | Trigger | Action |
| --- | --- | --- |
| Web p95 latency rising with CPU | Sustained > 800 ms | Add replica; profile slow route |
| DB CPU/IOPS saturation | Sustained > 70% | Add index, move reads to read models, then scale instance |
| Job queue depth growing | Age of oldest job > 10 min | Add worker replica; check for a poison job |
| Storage growth | Approach retention-adjusted forecast × 1.5 | Tighten retention, archive, partition |
| Sync volume growth | Batching causing long requests | Increase batch parallelism, cap batch size, add worker |

Scaling approach: **vertical first, then replicas**, then partitioning by business day or area.
No architectural change (microservices, sharding) without a new ADR and measured need.

---

## 6. Incident management (operational)

| Severity | Definition (business view) | Response target | Comms |
| --- | --- | --- | --- |
| S1 | Operators cannot work, or money records may be wrong/duplicated | Immediate; war-room style | In-app notice + WhatsApp broadcast to supervisors |
| S2 | Degraded: some features down, sync slow, HQ data stale | ≤ 2 h | Internal notice |
| S3 | Minor: cosmetic, single-tenant edge case | Next business day | Ticket |

Rules:

1. **Money-integrity doubts are S1** until disproven (e.g. suspected duplicate payments).
2. Human safety incidents reported through the app are **not** an engineering incident alone:
   the business escalation path runs in parallel (`RUNBOOK.md` §safety).
3. Communications use plain Indonesian for operators; technical detail stays internal.
4. Post-incident: blameless write-up within a week; runbook and alert changes tracked.

---

## 7. Support tooling expectations

| Tool | Purpose | Guardrails |
| --- | --- | --- |
| Read-only ops console (internal) | Inspect a shift/sale/payment/sync state | Scoped, logged, no raw PII export |
| Quarantine export/import (support-assisted) | Fix a device queue issue | Operator-initiated; record-scoped |
| Feature-flag toggle | Disable a misbehaving slice | Audited; expiry review |
| Requeue dead-letter job | Recover a job | Audited; idempotency guarantees safety |
| Retention dry-run report | Verify deletion policy | No PII; counts only |
| Break-glass production access | Emergency | Time-boxed, approved, fully logged, post-reviewed |

Note: the ops console is **not** a business tool — it cannot edit financial records. All
corrections go through the audited product paths.
