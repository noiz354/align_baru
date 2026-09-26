# OPERATIONS.md — Running HomeOps

> 2026-09-26 · Status: **DOCUMENTED, NOT EXERCISED** · Emergency procedures: RUNBOOK.md · Deployment: DEPLOYMENT.md · Signals: OBSERVABILITY.md.

## 1. Operating model

| Aspect | Reality |
| --- | --- |
| Operators | One person, part-time, no on-call rotation |
| Users | One household (maybe a few if hosting for family) |
| Availability target | ~99% monthly; maintenance windows acceptable (NFR-REL-005) |
| Change cadence | Small, frequent, reversible deploys |
| Escalation | There is no escalation path by design; the runbook *is* the escalation |
| Data sensitivity | High (household routines, problems, photos) — privacy rules apply to operators too |

**Operator principle:** automate the boring parts (backups, retention, health checks), and write down the scary parts (restore, deletion, compromise) so a tired person can follow them.

## 2. Routine calendar

| Frequency | Task | Evidence |
| --- | --- | --- |
| Continuous | Health endpoint polled externally; log capture running | health history |
| Daily (automatic) | Backup job, retention prune, scheduler ticks | backup timestamp, prune counts |
| Weekly | Restore drill into a scratch DB | entry in the restore log |
| Weekly | Skim: dead letters, scheduler failures, alert volume, disk usage | notes |
| Monthly | Dependency security review; OS package updates; review of the 30-day error trend | changelog entry |
| Quarterly | Secret rotation review; performance/budget re-check; ADR revisit list; docs drift check (`verify-docs`) | DECISIONS.md entry |
| Yearly | Full DR rehearsal incl. new-host rebuild from backup + image | written report |

## 3. Standing signals to watch

| Signal | Where | Healthy | Investigate |
| --- | --- | --- | --- |
| `scheduler_tick_age_seconds` | health `?deep=1` / metrics | < 2× cadence | > 15 min |
| Scheduler job failures | logs/metrics | 0 | any 3 consecutive |
| Outbox pending / dead letters | metrics | near 0 / 0 | rising |
| Notification delivery failures | metrics | < 5% | sustained > 5% |
| HTTP 5xx ratio | metrics | < 0.5% | > 1% in 15 min |
| DB size + disk free | host | > 30% free | < 20% free |
| Backup success timestamp | off-host storage | ≤ 26 h old | missing |
| Auth failures | metrics | baseline | spikes |
| Alert volume per member/day | metrics | ≤ 3 p95 | > 3 p95 (product signal, not infra) |

## 4. Change management

| Change type | Process |
| --- | --- |
| Product/code change | Task in TASKS.md → PR with checklist → CI → deploy checklist |
| Dependency bump | Read release notes → note in DECISIONS.md if notable → deploy |
| Migration | Reviewed SQL, additive-first, backup before, rollback plan in PR |
| Config change | Change in the secret store/env → restart → verify the affected signal |
| Emergency fix | Deploy via the normal path if possible; if not, document the deviation within 24 h |

## 5. Data lifecycle operations

| Operation | Frequency | Notes |
| --- | --- | --- |
| Retention prune (activity, alerts, delivery records, level history) | nightly, automatic | Verify counts monthly (T-OPS-002) |
| Backup | nightly | DB + attachments; 30-day retention |
| Restore drill | weekly | Scratch database, never production |
| Export request | on demand | Owner-initiated from settings; audited |
| Household deletion request | on demand, manual | Follow RUNBOOK#household-deletion-request; keep a written confirmation |
| Attachment purge | nightly with retention | Soft-delete grace period of 30 days |

## 6. Capacity guidance

| Signal | Threshold | Likely cause | Action |
| --- | --- | --- | --- |
| Disk > 80% | any | attachments, logs, old images | prune images, rotate logs, check attachment retention |
| Memory > 80% sustained | any | runaway job, leak | check job timeouts; restart; investigate |
| DB connections near pool max | any | slow queries holding connections | inspect slow-query log; add index per DATA_MODEL.md |
| p95 dashboard > 1.2 s for a week | any | scan/aggregation regression | `EXPLAIN` the read models; verify indexes |
| > 50 households on one instance | scale boundary | growth | revisit pooling/backup windows (PERFORMANCE.md §2.3) |

## 7. Known limitations (documented, not bugs)

- iOS push requires the PWA to be installed to the home screen (ADR-014).
- Offline is read-only with explicit staleness; mutations require connectivity (ADR-014).
- Email is optional; invitation links can be shared manually (PRD A-4).
- No self-service household deletion; it is an operator-verified procedure (PRIVACY.md §7).
- Single host = single point of failure; recovery depends on backups (NFR-REL-005 accepted).

## 8. Privacy obligations for operators

- Do not browse household content in the database; the product deliberately provides no admin UI for it (PRIVACY.md §4).
- Never paste household data (names, notes, photos) into tickets, chat, or AI tools.
- Logs are for diagnosis: use ids, not content.
- Deletion and export requests are honoured within 30 days and logged.
- Operator access itself is a privacy surface: keep SSH keys protected, use a password manager, and enable disk encryption where offered.

## 9. Bus-factor notes

Everything needed to run HomeOps is in this repository: DEPLOYMENT.md (setup), OPERATIONS.md (routine), RUNBOOK.md (incidents), docs/operations/* (details). Secrets and the domain are the only external assets; both are recorded (names, not values) in the operator's password manager with an access note for a trusted person.
