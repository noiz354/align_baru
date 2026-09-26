# StrangerLink — Observability

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-015](docs/adr/ADR-015-observability.md), [RUNBOOK.md](RUNBOOK.md), [PERFORMANCE.md](PERFORMANCE.md)

---

## 0. Position

We must be able to see **everything about the health of the system** and **nothing about
the content of conversations**.

This is a narrow design space and it is drawn deliberately. A dashboard that shows chat
messages is a privacy violation and a moderation liability. A dashboard that shows only
"messages per second" cannot debug a signaling race. The rules below are the boundary.

**Requirement:** NFR-OBS-002 — dashboards must never display private chat contents.

---

## 1. Instrumentation policy

| Rule | Detail |
| --- | --- |
| **No content, ever** | Message bodies, report notes, SDP bodies, and media are never span attributes or log fields |
| **No peer linkage** | A span never carries both participants' identifiers. It carries the session id and one participant's **role** (`A` or `B`) |
| **No addresses** | No IP addresses, no ICE candidate strings, no ports |
| **Identifiers on spans, not metrics** | Session id and participant id may appear on spans; **never** as metric labels (cardinality) |
| **Sampling** | Head-based sampling, with an elevated rate for error and safety spans |
| **Correlation** | Trace context propagated through signaling so a session can be followed end to end |
| **One helper** | A shared tracing helper is the only permitted way to create spans; it accepts an attribute allowlist |

---

## 2. Metrics

### 2.1 Queue and matchmaking

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `queue.size` | Gauge | `mode` | Current waiting participants |
| `queue.join.latency` | Histogram | `mode` | PB-3 |
| `matchmaking.latency` | Histogram | `mode`, `outcome` | PB-4; join → `MATCH_FOUND` |
| `matchmaking.match.created` | Counter | `mode` | Throughput |
| `matchmaking.match.failed` | Counter | `reason_class` | Failure diagnosis |
| `matchmaking.cancellation_race` | Counter | — | R2/R9 observability |
| `queue.abandoned` | Counter | `reason_class` | UX and capacity |
| `queue.cooldown.triggered` | Counter | `ladder_step` | Abuse signal |

### 2.2 Sessions

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `session.created` | Counter | `mode` | Throughput |
| `session.duration` | Histogram | `mode`, `end_reason` | Behaviour and safety |
| `session.ended` | Counter | `end_reason` | **Core safety metric** |
| `session.active` | Gauge | `mode` | Load |
| `session.per_participant` | Gauge | — | **Must never exceed 1** (INV-1) |
| `session.superseded` | Counter | `reason_class` | R8/R12 observability |

### 2.3 Realtime and signaling

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `ws.connections` | Gauge | `instance` | Load; leak detection |
| `ws.disconnects` | Counter | `reason_class` | Reliability |
| `ws.errors` | Counter | `code` | Reliability |
| `signaling.messages` | Counter | `type`, `direction` | Throughput |
| `signaling.validation_failed` | Counter | `type` | Attack signal |
| `signaling.duplicate_dropped` | Counter | — | R6 observability |
| `signaling.protocol_violation` | Counter | `violation_class` | **Attack signal — alerted** |
| `signaling.rate_limited` | Counter | `type` | Abuse signal |

### 2.4 Media and WebRTC

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `webrtc.setup.attempts` | Counter | `mode` | Throughput |
| `webrtc.setup.succeeded` | Counter | `mode`, `path` | `direct` / `relay` |
| `webrtc.setup.failed` | Counter | `reason_class` | Reliability |
| `webrtc.setup.duration` | Histogram | `mode` | PB-7/PB-8 |
| `webrtc.ice_restarts` | Counter | `trigger` | Network stability |
| `webrtc.permission_denied` | Counter | `media_type` | UX |
| `turn.allocations` | Gauge | `instance` | Capacity |
| `turn.relayed_bytes` | Counter | `instance` | **Cost** |
| `turn.share_of_sessions` | Gauge | `mode` | Cost and connectivity |
| `turn.allocation_failed` | Counter | `reason_class` | Availability |

### 2.5 Safety and moderation

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `safety.reports` | Counter | `category`, `severity` | Abuse prevalence |
| `safety.report_rate` | Gauge | `severity` | Reports per 1,000 sessions |
| `safety.report_after_disconnect` | Counter | — | **Proves FR-REPORT-002 works** |
| `safety.blocks` | Counter | `scope` | Abuse prevalence |
| `safety.bans` | Counter | `severity`, `source` | Enforcement intensity |
| `safety.ban_appeals` | Counter | `outcome` | **Proportionality check** |
| `safety.moderation_actions` | Counter | `action` | Enforcement distribution |
| `safety.p0.ack_latency` | Histogram | — | **Escalation health** |
| `safety.p0.unacknowledged` | Gauge | — | **Alerted** |
| `safety.escalations` | Counter | `type` | — |
| `safety.rate_limit_triggered` | Counter | `limit_name` | Abuse signal |
| `safety.insufficient_close_rate` | Gauge | — | Report quality / metadata window |

### 2.6 Platform

| Metric | Type | Labels | Purpose |
| --- | --- | --- | --- |
| `http.request.duration` | Histogram | `route`, `method`, `status` | SB-1 |
| `http.request.errors` | Counter | `route`, `status` | Reliability |
| `db.pool.saturation` | Gauge | — | SB-4 |
| `db.query.duration` | Histogram | `operation` | Reliability |
| `retention.job.runs` | Counter | `result` | **Alerted on failure** |
| `retention.job.rows_deleted` | Counter | `tier` | Verification |

---

## 3. Traces

### 3.1 Spans

| Span | Parent | Attributes |
| --- | --- | --- |
| `queue.join` | request | `participant_id`, `mode`, `outcome` |
| `matchmaking.select` | `queue.join` | `mode`, `candidates_scanned`, `outcome`, `reason_class` |
| `session.create` | `matchmaking.select` | `session_id`, `mode`, `role` |
| `signaling.dispatch` | socket frame | `session_id`, `type`, `role`, `sequence` |
| `chat.message.relay` | `signaling.dispatch` | `session_id`, `role`, `length_bucket` — **never the body** |
| `webrtc.setup` | `session.create` | `session_id`, `mode`, `path`, `reason_class` |
| `report.submit` | request | `session_id`, `category`, `severity` |
| `block.create` | request | `session_id`, `scope` |
| `moderation.action` | request | `case_id`, `action`, `actor_role` |
| `ban.check` | request | `participant_id`, `outcome` |

`length_bucket` is a coarse bucket (`<100`, `100-500`, `500-2000`), not the actual length,
and certainly not the content.

### 3.2 Trace propagation

Trace context is propagated through the signaling plane so a session can be followed from
queue join through match through media setup through session end, across service
boundaries.

---

## 4. Alerts

Every alert has a [RUNBOOK.md](RUNBOOK.md) entry and an owner. **Safety alerts page;
performance alerts ticket.**

| Alert | Condition | Severity | Runbook |
| --- | --- | --- | --- |
| P0 escalation unacknowledged | > 15 min | **Page** | RB-06 |
| Report rate spike | Statistical anomaly vs. 7-day baseline | **Page** | RB-07 |
| Retention job failure | Any failed run | **Page** | RB-09 |
| Sessions per participant > 1 | Observed at all | **Page** | RB-02 |
| Signaling protocol violation spike | > baseline | **Page** | RB-03 |
| Ban store unreachable | Any occurrence | **Page** | RB-04 |
| TURN allocation failure spike | > 5% of attempts | Ticket | RB-08 |
| TURN relayed bytes spike | Cost threshold | Ticket | RB-08 |
| Match latency p95 breach | > PB-4 p95 for 10 min | Ticket | RB-01 |
| WebSocket error rate spike | > baseline | Ticket | RB-05 |
| Queue size sustained above capacity | > 10 min | Ticket | RB-01 |
| Database pool saturation | > 80% | Ticket | RB-08 |
| WebRTC setup failure rate | > 10% | Ticket | RB-05 |
| Ban appeal overturn rate | > 5% | Ticket | RB-07 |
| `session.per_participant` gauge drift | Non-zero anomalies | Ticket | RB-02 |

---

## 5. Logging

### 5.1 What is logged

| Logged | Detail |
| --- | --- |
| Request metadata | Route, method, status, duration, trace id |
| Realtime lifecycle | Connect, disconnect, reason class |
| Validation failures | Message type, failure class — **never the payload** |
| Safety events | Type, participant id, session id, minimal typed payload |
| Errors | Class, server-side stack, trace id |
| Retention runs | Rows deleted per tier |

### 5.2 What is never logged

| Never | Why |
| --- | --- |
| Chat message content | Does not exist durably |
| Report notes | Redacted in application logs |
| IP addresses | Only coarse hashes, separately stored |
| TURN credentials | Secret |
| Session tokens | Secret |
| SDP bodies | Privacy |
| Peer network addresses | Privacy |
| Stack traces to clients | `INTERNAL` returns a fixed string |

### 5.3 Log access

Logs are access-controlled, access is audited, and logs have their own retention tier
(Tier 5, 13 months).

---

## 6. Dashboards

| Dashboard | Audience | Contents |
| --- | --- | --- |
| **Overview** | On-call | Queue size, match rate, session rate, error rate, alerts |
| **Realtime** | Realtime engineering | Connections, signaling rates, validation failures, races |
| **Media** | Realtime engineering | Setup success/failure, ICE restarts, TURN usage and share |
| **Safety** | Trust & Safety | Report rate, category distribution, bans, appeals, P0 latency |
| **Platform** | SRE | Latency, error rate, pool saturation, retention runs |
| **Cost** | Engineering + Finance | TURN relayed bytes, allocation count |

### Explicitly forbidden dashboards

- Any dashboard rendering chat content.
- Any "user timeline" reconstructing a participant's session history across identities.
- Any dashboard labelled with an IP address, device identifier, or report note.

---

## 7. SLOs

| SLO | Target | Window |
| --- | --- | --- |
| Queue join availability | 99.9% | 30 days |
| Match success rate | 99% of matched sessions reach `ACTIVE` | 30 days |
| Text message delivery p95 | < 500 ms | 30 days |
| WebRTC setup success rate | 95% of media-mode sessions | 30 days |
| P0 acknowledgement | 99% within 15 min | 30 days |
| Report submission availability | **100%** | 30 days |

**Report submission has no error budget.** If reporting is degraded, that is an incident
regardless of any other SLO.

---

## 8. Implementation status

No instrumentation exists. Metric and span definitions are specified here and in
[src/server/telemetry/](src/server/telemetry/). Tracked as **T-OBS-111** in
[TASKS.md](TASKS.md).
