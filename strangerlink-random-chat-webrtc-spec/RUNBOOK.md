# StrangerLink — Runbook

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [OPERATIONS.md](OPERATIONS.md), [OBSERVABILITY.md](OBSERVABILITY.md)

> **These runbooks are untested.** They must be drilled before production (VS-15). A
> runbook that has never been executed is not a runbook.

---

## How to use this runbook

Each entry has: **Alert · Severity · Detection · Impact · Immediate action · Diagnosis ·
Mitigation · Escalation · Prevention · Verification.**

Safety runbooks page. Performance runbooks ticket.

---

## RB-01 — Match latency breach

| Field | Value |
| --- | --- |
| **Alert** | `matchmaking.latency` p95 above budget for 10 minutes |
| **Severity** | SEV-2 (ticket) |
| **Detection** | Prometheus alert on the `matchmaking.latency` histogram |
| **Impact** | Users wait longer; some abandon the queue |
| **Immediate action** | Check queue size. If the queue is large, this is load, not a fault — no action beyond monitoring |
| **Diagnosis** | Is queue size elevated? Is match throughput normal? Are eligibility checks slow (database latency)? Is the realtime service CPU-saturated? |
| **Mitigation** | If eligibility checks are slow, check database latency and pool saturation. If the realtime service is saturated, consider the connection cap. If load is organic, consider disabling interest matching (`interestMatching.enabled=false`) to widen the candidate pool |
| **Escalation** | Realtime engineering |
| **Prevention** | Load testing before VS-15; interest matching is the first thing to disable under load |
| **Verification** | p95 returns to budget; queue size normalises |

---

## RB-02 — Sessions per participant exceeds 1

| Field | Value |
| --- | --- |
| **Alert** | `session.per_participant` gauge anomaly, or a duplicate-session event |
| **Severity** | **SEV-1 — page** |
| **Detection** | Metric anomaly; invariant violation event |
| **Impact** | **A safety invariant is broken.** A user could be matched with two strangers simultaneously, or a banned user could hold a stale session |
| **Immediate action** | **Stop new matches** (`signaling.newSessions.enabled=false`). This preserves existing sessions while stopping the bleeding |
| **Diagnosis** | Which path bypassed the single-flight claim? Concurrent match attempts? A reconnect that superseded incorrectly? A database constraint gap? |
| **Mitigation** | If a specific code path is identified, disable it. If the cause is unknown, keep new matches disabled until it is found |
| **Escalation** | **Trust & Safety + Architecture.** This is a safety incident regardless of observed user impact |
| **Prevention** | INV-1 enforced by a single primitive; a database-level partial unique index as a second layer; the "prevents one participant from entering two active sessions" test |
| **Verification** | Root cause identified; the invariant holds under the concurrency test suite; a post-incident review is written |

---

## RB-03 — WebSocket error spike

| Field | Value |
| --- | --- |
| **Alert** | `ws.errors` rate above baseline |
| **Severity** | SEV-2 (ticket) |
| **Detection** | Prometheus alert |
| **Impact** | Users cannot connect or are disconnected |
| **Immediate action** | Check realtime service health and instance count |
| **Diagnosis** | Is the service up? Is memory growing (leak)? Are zombies accumulating? Is a deploy in progress? Is there a client-side bug from a recent release? |
| **Mitigation** | Restart the realtime service if a leak is suspected (in-flight sessions end with `server-restart` and users are returned to a clean state). Roll back the release if correlated |
| **Escalation** | Realtime engineering |
| **Prevention** | Heartbeat with `terminate()` for zombies; connection-count alerting; graceful drain on deploy |
| **Verification** | Error rate returns to baseline; connection count stable |

---

## RB-04 — Ban store unreachable

| Field | Value |
| --- | --- |
| **Alert** | Any ban-check failure |
| **Severity** | **SEV-1 — page** |
| **Detection** | Error rate on the `ban.check` path |
| **Impact** | **The system fails closed.** No new matches are created. This is correct behaviour and will look like an outage |
| **Immediate action** | Confirm the fail-closed behaviour is active. Do **not** attempt to bypass it to restore matching |
| **Diagnosis** | Is PostgreSQL reachable? Is the connection pool exhausted? Is the ban query slow or failing? |
| **Mitigation** | Restore database availability. If the pool is exhausted, check for a connection leak |
| **Escalation** | SRE + Trust & Safety |
| **Prevention** | Pool saturation alerting; connection limits; ban checks fail closed by design |
| **Verification** | Ban checks succeed; matching resumes; confirm no matches were created while the store was unavailable |

**Never disable fail-closed behaviour to restore availability.** An outage is recoverable;
a banned user reaching a stranger is not.

---

## RB-05 — WebRTC setup failure spike

| Field | Value |
| --- | --- |
| **Alert** | `webrtc.setup.failed` rate above 10% |
| **Severity** | SEV-2 (ticket) |
| **Detection** | Prometheus alert |
| **Impact** | Video and audio fail for a subset of users |
| **Immediate action** | Check `turn.share_of_sessions` and `turn.allocation_failed` |
| **Diagnosis** | Is coturn healthy? Are allocations failing? Is the relay port range correct? Is a browser release involved? Is the credential-minting endpoint failing? |
| **Mitigation** | If coturn is the cause, restore it. If media is broadly broken, disable video (`media.video.enabled=false`) and then audio. **Text chat is unaffected and continues** |
| **Escalation** | Realtime engineering |
| **Prevention** | coturn monitoring; relay port smoke test; ICE restart logic |
| **Verification** | Setup success rate recovers; users see a specific failure state, not a hang |

---

## RB-06 — P0 escalation unacknowledged

| Field | Value |
| --- | --- |
| **Alert** | `safety.p0.unacknowledged` above 15 minutes |
| **Severity** | **SEV-1 — page, escalate immediately** |
| **Detection** | Prometheus alert on the P0 gauge |
| **Impact** | **A minor-safety or illegal-content report is not being handled.** This is the highest-severity operational condition in the system |
| **Immediate action** | Page the secondary on-call and Trust & Safety leadership. Do not wait for the primary |
| **Diagnosis** | Is the paging integration working? Is the on-call reachable? Is the case routed correctly? |
| **Mitigation** | Acknowledge the case manually via the admin surface. Restrict the reported identity immediately, before investigation |
| **Escalation** | Trust & Safety leadership; legal counsel if the category is illegal content |
| **Prevention** | P0 routing bypasses the normal queue; acknowledgement latency SLO; paging integration tested in drills |
| **Verification** | Case acknowledged; identity restricted; post-incident review if the paging path failed |

---

## RB-07 — Report rate spike

| Field | Value |
| --- | --- |
| **Alert** | `safety.report_rate` statistical anomaly vs. the 7-day baseline |
| **Severity** | **SEV-1 — page** |
| **Detection** | Anomaly detection on the report rate |
| **Impact** | Either a coordinated abuse campaign or a coordinated false-report campaign. Both are serious |
| **Immediate action** | Pull the report category distribution. A spike in one category indicates targeted abuse; a spread across categories indicates a false-report campaign |
| **Diagnosis** | Are reports concentrated on specific identities (abuse) or from specific identities (false reports)? Is the report rate per session elevated, or just total volume from a traffic spike? |
| **Mitigation** | For an abuse campaign: tighten rate limits and cooldowns; consider disabling media modes. For a false-report campaign: apply credibility weighting; do **not** action the reports automatically |
| **Escalation** | Trust & Safety |
| **Prevention** | Report credibility weighting; report rate limits; category-level monitoring |
| **Verification** | Rate returns to baseline; no innocent identity was restricted |

**Do not mass-ban in response to a report spike.** A spike is a signal to investigate, not
a licence to over-enforce. The appeal overturn rate will show the damage.

---

## RB-08 — TURN bandwidth spike

| Field | Value |
| --- | --- |
| **Alert** | `turn.relayed_bytes` above the cost threshold, or allocation failure spike |
| **Severity** | SEV-2 (ticket) |
| **Detection** | Prometheus alert |
| **Impact** | Cost; potential TURN abuse; degraded video for others |
| **Immediate action** | Identify the top consuming identities from the bandwidth accounting |
| **Diagnosis** | Is one identity consuming disproportionately (abuse), or is this organic video growth? Are allocations leaking? |
| **Mitigation** | Rate limit and review the offending identities. If organic, add coturn capacity. If abuse, tighten per-identity quotas |
| **Escalation** | SRE + Trust & Safety |
| **Prevention** | Per-identity and per-server allocation quotas; bandwidth accounting; video bitrate caps |
| **Verification** | Bandwidth returns to trend; offending identities reviewed |

---

## RB-09 — Retention job failure

| Field | Value |
| --- | --- |
| **Alert** | `retention.job.runs` with `result=failure` |
| **Severity** | **SEV-1 — page** |
| **Detection** | Prometheus alert on the retention job counter |
| **Impact** | **Data is being retained beyond the disclosed schedule.** This is a privacy incident, not a background error |
| **Immediate action** | Page the on-call. Notify the privacy owner |
| **Diagnosis** | Did the job fail to run, or fail partway? Is the database reachable? Is a lock held? |
| **Mitigation** | Re-run the job (it is idempotent). If it fails again, investigate before re-running |
| **Escalation** | Privacy owner + SRE |
| **Prevention** | Idempotent, logged job; alerting on failure; verification tests assert expired rows are gone |
| **Verification** | Job completes; verification test passes; the over-retention window is documented and disclosed to the privacy owner |

---

## RB-10 — Signaling protocol violation spike

| Field | Value |
| --- | --- |
| **Alert** | `signaling.protocol_violation` rate above baseline |
| **Severity** | **SEV-1 — page** |
| **Detection** | Prometheus alert |
| **Impact** | An active attack on the signaling plane — impersonation or cross-session injection attempts |
| **Immediate action** | Confirm connections are being closed on violation. Check whether any violation succeeded |
| **Diagnosis** | Which violation class? Is it concentrated on one identity or distributed? Is a new client build misbehaving? |
| **Mitigation** | Restrict the offending identities. If the attack is distributed, tighten connection rate limits and consider CAPTCHA on new connections |
| **Escalation** | Security + Trust & Safety |
| **Prevention** | Envelope validation in the dispatch layer; `fromParticipantId` binding; server-derived recipients |
| **Verification** | Violation rate returns to baseline; no successful injection is found |

---

## RB-11 — Web service down

| Field | Value |
| --- | --- |
| **Alert** | `http.request.errors` rate, or health check failure |
| **Severity** | SEV-2 (ticket), SEV-1 if total |
| **Detection** | Health check and error rate |
| **Impact** | No new sessions, no reports via the web tier |
| **Immediate action** | Check the service and its dependencies |
| **Diagnosis** | Is the process up? Is the database reachable? Is a deploy in progress? Is memory or CPU saturated? |
| **Mitigation** | Roll back if a deploy is correlated. Restart if a resource issue. Existing sessions continue — the realtime service is independent |
| **Escalation** | Product engineering |
| **Prevention** | Health checks; rolling deploys; dependency isolation |
| **Verification** | Service healthy; error rate normal |

**Note:** if the web tier is down but the realtime service is up, existing sessions
continue. Report submission may be degraded — treat any report-path degradation as a
safety matter, not just an availability matter.

---

## RB-12 — Realtime service restart under load

| Field | Value |
| --- | --- |
| **Alert** | Connection count drop to zero, or a restart event |
| **Severity** | SEV-2 (ticket) |
| **Detection** | `ws.connections` gauge drop; restart event |
| **Impact** | All in-flight sessions on that instance end with `server-restart`; the queue is lost |
| **Immediate action** | Confirm the service is back up and accepting connections |
| **Diagnosis** | Was this a planned deploy, an OOM kill, or a crash? |
| **Mitigation** | If OOM, investigate the leak before the next deploy. If a crash, capture the stack |
| **Escalation** | Realtime engineering |
| **Prevention** | Graceful drain; memory budgets; leak testing |
| **Verification** | Service healthy; users were returned to a clean state, not left hanging |

---

## RB-13 — Moderation disconnect complaint

| Field | Value |
| --- | --- |
| **Alert** | A user reports a moderation disconnect as a mistake |
| **Severity** | SEV-3, unless a pattern emerges |
| **Detection** | A report with category "other" referencing a moderation disconnect |
| **Impact** | A potentially wrongful restriction |
| **Immediate action** | Route to the appeal queue; the appeal is reviewed by a moderator other than the issuer |
| **Diagnosis** | Was the action correct? Was the signal reliable? Was the policy version current? |
| **Mitigation** | Revoke the ban or restriction if it was wrong; audited |
| **Escalation** | Trust & Safety |
| **Prevention** | Progressive enforcement; proportionality monitoring via the appeal overturn rate |
| **Verification** | Appeal resolved; the overturn rate is tracked as a proportionality signal |

---

## RB-14 — Suspected minor in a session

| Field | Value |
| --- | --- |
| **Alert** | A report with category "minor safety" |
| **Severity** | **SEV-1 — page, immediate** |
| **Detection** | Report submission with category `minor-safety` |
| **Impact** | Potential harm to a child |
| **Immediate action** | The session is already terminated by the report path. **Restrict the reported identity immediately**, before investigation |
| **Diagnosis** | Review the session metadata and report note. Do not attempt to reconstruct the conversation — it does not exist |
| **Mitigation** | Restrict; escalate to legal counsel if the content may be illegal |
| **Escalation** | Trust & Safety leadership; legal counsel |
| **Prevention** | 18+ age gate; P0 routing; immediate restriction on report |
| **Verification** | Identity restricted; case escalated; audited |

---

## 15. Quick reference

| Situation | Do this |
| --- | --- |
| Mass abuse | Disable media modes → tighten rate limits → restrict identities |
| False-report campaign | Apply credibility weighting → do **not** mass-ban |
| Ban store down | Fail closed. Do not bypass |
| Invariant broken | Stop new matches. Page Trust & Safety |
| P0 unacknowledged | Page secondary and Trust & Safety leadership |
| Retention failed | Re-run. Notify privacy owner. Treat as a privacy incident |
| TURN cost spike | Identify top consumers → rate limit → review |
| Suspected minor | Restrict immediately. Escalate to leadership and counsel |
| Media broken | Disable video, then audio. Text continues |

---

## Implementation status

No runbook has been executed. Drills are scheduled for VS-15. Each entry above must be
drilled at least once before production.
