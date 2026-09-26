# StrangerLink — Operations

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [RUNBOOK.md](RUNBOOK.md), [DEPLOYMENT.md](DEPLOYMENT.md), [OBSERVABILITY.md](OBSERVABILITY.md)

---

## 0. Position

The product must be operable by **one engineer on-call** (NFR-OPS-001). Every operational
responsibility below has a documented procedure, an owner, and — where it is a safety
matter — a page-worthy alert.

---

## 1. Ownership

| Area | Owner | On-call scope |
| --- | --- | --- |
| Web service | Product engineering | Availability, latency |
| Realtime service | Realtime engineering | Availability, connection health |
| coturn | Realtime engineering + SRE | Availability, bandwidth, cost |
| PostgreSQL | SRE | Availability, retention, backups |
| Safety enforcement | **Trust & Safety** | **Safety incidents page** |
| Observability | SRE | Telemetry pipeline |
| Deployments | Product engineering | Release safety |

**Trust & Safety has authority to require changes in any other area when a safety property
is at risk.** This asymmetry is deliberate.

---

## 2. On-call

| Property | Commitment |
| --- | --- |
| Rotation | Primary + secondary |
| Safety incidents | Page the primary; Trust & Safety is always reachable for P0 |
| Response targets | P0 safety: immediate. P1: 15 minutes. P2: same business day |
| Escalation | Documented in [RUNBOOK.md](RUNBOOK.md) |
| Handover | Written; open incidents and pending safety cases are handed over explicitly |

---

## 3. Routine operations

### 3.1 Daily

| Task | Owner |
| --- | --- |
| Review safety alerts and P0 acknowledgement latency | Trust & Safety |
| Review report rate against baseline | Trust & Safety |
| Review error rates and latency SLOs | On-call |
| Confirm the retention job ran | SRE |

### 3.2 Weekly

| Task | Owner |
| --- | --- |
| Review ban appeal overturn rate (proportionality) | Trust & Safety |
| Review TURN bandwidth and cost trend | SRE |
| Review moderation case backlog and resolution time | Trust & Safety |
| Review unresolved reports and "insufficient information" rate | Trust & Safety |

### 3.3 Monthly

| Task | Owner |
| --- | --- |
| Review indefinite bans | Trust & Safety |
| Review moderator case volume and wellbeing | Trust & Safety |
| Review alert noise; retire or tune noisy alerts | SRE |
| Review observability cost and sampling | SRE |
| Rotate the TURN static auth secret | SRE + Realtime |

### 3.4 Quarterly

| Task | Owner |
| --- | --- |
| Safety policy review | Trust & Safety |
| Limitations statement review | Trust & Safety |
| Retention schedule review | Trust & Safety + Legal |
| Data inventory review | Privacy + Engineering |
| IP exposure policy review | Privacy + Trust & Safety |
| Runbook drill (every runbook, at least one scenario each) | SRE + On-call |
| Disaster recovery drill | SRE |

---

## 4. Safety operations

### 4.1 P0 handling

| Step | Detail |
| --- | --- |
| 1 | Alert pages the on-call |
| 2 | On-call acknowledges within 15 minutes (SLO) |
| 3 | Trust & Safety senior moderator is engaged |
| 4 | The identity is restricted immediately, before investigation completes |
| 5 | Legal counsel is engaged where the matter may require law-enforcement escalation |
| 6 | **The on-call engineer does not contact law enforcement directly** |
| 7 | Every step is audited |

### 4.2 Ban management

| Task | Procedure |
| --- | --- |
| Issue a ban | Via the admin surface; requires a reason code; audited |
| Extend a ban | Requires senior moderator |
| Revoke a ban | Requires senior moderator; appeals are reviewed by a different moderator |
| Review indefinite bans | Monthly; each review is audited |
| Ban a shared-IP signal alone | **Not permitted.** A shared-IP signal can only trigger a rate limit or cooldown |

### 4.3 Moderator operations

| Task | Procedure |
| --- | --- |
| Onboard a moderator | Training on policy, escalation, and the audit requirement; MFA enrolment |
| Rotate off P0 queues | Scheduled; documented |
| Escalate a case | A moderator can escalate any case they cannot handle |
| Debrief after P0 | Scheduled |
| Suspend a moderator | Admin action; audited |

---

## 5. Incident management

| Severity | Definition | Response |
| --- | --- | --- |
| **SEV-1** | Safety incident (minor safety, illegal content, mass abuse) or total outage | Page immediately; Trust & Safety engaged; written post-incident review mandatory |
| **SEV-2** | Degraded service affecting a subset of users | Page; fix or mitigate; review |
| **SEV-3** | Minor degradation or a single-user impact | Ticket |

**A safety incident is never downgraded because the user impact is small.** One minor-safety
case is SEV-1 regardless of scale.

### Post-incident review

Mandatory for SEV-1 and SEV-2. Must answer:

1. What happened, in timeline form.
2. What safety property was affected, if any.
3. Which detection failed or was absent.
4. What mitigation was applied.
5. What prevents recurrence — a task, a test, an alert, or an ADR change.
6. Was any personal data exposed, and was the retention schedule honoured?

---

## 6. Change management

| Change class | Approval required |
| --- | --- |
| Routine deploy | Automated, staging green |
| Kill switch operation | Trust & Safety can act unilaterally |
| Safety policy change | Trust & Safety + Architecture |
| Retention change | Trust & Safety + Legal |
| New ADR-worthy decision | Architecture owner |
| Fingerprinting or media capture | **Not permitted** without a privacy impact assessment and a new ADR |

**Every safety-relevant configuration change is auditable** (NFR-OPS-002). Kill switch
operations are logged with actor, switch, and reason.

---

## 7. Capacity and cost

| Resource | Review cadence | Owner |
| --- | --- | --- |
| TURN bandwidth | Weekly | SRE |
| coturn allocations | Weekly | SRE |
| Realtime connections | Weekly | SRE |
| Database size and growth | Monthly | SRE |
| Observability cost | Monthly | SRE |
| Overall infrastructure cost | Monthly | Engineering + Finance |

**TURN bandwidth is the dominant variable cost.** It is reviewed weekly, not monthly,
because a bandwidth spike is both a cost incident and a potential abuse signal.

---

## 8. Backup and recovery

| Property | Commitment |
| --- | --- |
| Backups | Automated, encrypted, access-controlled |
| Backup retention | Must not exceed the longest retention tier (24 months) plus a short margin |
| Deletion propagation | Deletions propagate on the backup rotation schedule |
| Recovery drill | Quarterly |
| Recovery target | Documented per data class; safety records are the priority |

Because chat content and media are never stored, **there is nothing sensitive to recover
and nothing sensitive to lose.** The recovery story is unusually simple.

---

## 9. Secret rotation procedures

| Secret | Procedure |
| --- | --- |
| TURN static auth secret | Generate a new secret; deploy to coturn and the minting service; verify minting works; retire the old secret after all in-flight credentials expire (minutes) |
| Database credentials | Create a new role credential; deploy; verify; revoke the old |
| Identity token signing key | Deploy the new key; accept both during a grace window; retire the old |
| OTel exporter credentials | Rotate; verify export resumes |

Every rotation is logged and audited.

---

## 10. Runbook drills

Every runbook entry is drilled at least quarterly. A runbook that has never been executed
is not a runbook. Drill results are recorded, and gaps become tasks.

---

## 11. Operational metrics

| Metric | Target |
| --- | --- |
| P0 acknowledgement latency | < 15 minutes |
| Mean time to detect (safety) | < 5 minutes |
| Mean time to mitigate (safety) | < 30 minutes |
| Retention job success rate | 100% |
| Deploy frequency | Weekly or better |
| Change failure rate | < 5% |
| Alert noise (pages per week) | < 3 |

---

## 12. Implementation status

No operational procedure has been executed. Runbooks are specified in
[RUNBOOK.md](RUNBOOK.md); drills are scheduled for VS-15.
