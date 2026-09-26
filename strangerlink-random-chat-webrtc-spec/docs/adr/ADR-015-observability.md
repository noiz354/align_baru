# ADR-015 — Observability

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture + SRE
- **Related:** [ADR-003](ADR-003-realtime-transport.md), [ADR-010](ADR-010-moderation-model.md), [ADR-016](ADR-016-deployment.md)

## Context

This product has an unusual observability constraint: **we must be able to see
everything about the health of the system while seeing nothing about the content of
conversations.**

A dashboard that shows chat messages would be a privacy violation and a moderation
liability. A dashboard that shows only "messages per second" loses the ability to debug
signaling races. The design space in between is narrow and must be drawn deliberately.

We also need observability for **safety**, not just reliability: report rate spikes, ban
evasion patterns, and TURN credential abuse are all things we must be able to see and
alert on.

## Problem

What do we instrument, with what granularity, and what must never be instrumented?

## Decision Drivers

1. **Privacy.** No content, no addresses, no identity linkage beyond what a safety
   investigation legitimately needs.
2. **Debuggability.** We must be able to diagnose signaling races and media failures.
3. **Safety signal.** Report and ban anomalies must be visible.
4. **Cost.** Cardinality discipline; a metric per session id is unaffordable.
5. **Vendor neutrality.** OpenTelemetry over a proprietary agent.
6. **Actionability.** Every alert must have a runbook entry.

## Options Considered

### Option A — Full-fidelity logging including message content

**Strengths:** Perfect debuggability.

**Weaknesses:** A privacy catastrophe and a moderation liability. **Rejected outright.**

### Option B — Metrics only, no tracing

**Strengths:** Cheap, simple.

**Weaknesses:** Cannot diagnose a distributed race across queue → match → session →
signaling. **Rejected** — the races in this system are exactly what tracing is for.

### Option C — OpenTelemetry traces + metrics, envelope-only, with a strict
no-content policy and a review gate on new instrumentation

### Option D — Vendor-proprietary APM agent

**Strengths:** Turnkey.

**Weaknesses:** Lock-in; harder to enforce a custom no-content policy; less control over
sampling. Rejected in favour of OTel with a vendor backend.

## Decision

**Adopt Option C: OpenTelemetry traces and metrics, envelope-only, with a strict
no-content policy enforced by review and by test.**

### The instrumentation policy

| Rule | Detail |
| --- | --- |
| **No content, ever** | Message bodies, report notes, SDP bodies, and media are never attributes |
| **No peer linkage** | A span never carries both participants' identifiers. It carries the session id and one participant's role (`A`/`B`) |
| **No addresses** | No IP addresses, no candidate strings, no port numbers |
| **Identifiers are fine, sparsely** | Session id and participant id are permitted on spans, but **not** as metric labels (cardinality) |
| **Sampling** | Head-based sampling with an elevated rate for error and safety spans |
| **Correlation** | Trace context propagated through signaling so a session can be followed end to end |

### What we measure

**Queue and matching**

- Queue size (gauge, per mode)
- Queue join latency (histogram)
- Match latency, join → `MATCH_FOUND` (histogram)
- Match failure rate (counter, by reason class)
- Queue abandonment and expiry (counter)
- Cancellation-during-match races (counter)

**Sessions**

- Session creation rate (counter)
- Session duration (histogram)
- Session end reason distribution (counter) — peer-left, skip, report, block, timeout,
  moderation, server-restart
- Sessions per participant (gauge) — must never exceed 1

**Realtime**

- WebSocket connections (gauge)
- WebSocket errors and disconnects (counter, by reason)
- Signaling message rate and validation failures (counter)
- Duplicate/replayed message drops (counter)
- Protocol violation events (counter) — impersonation attempts, cross-session attempts

**Media**

- WebRTC setup success/failure (counter)
- WebRTC setup time (histogram)
- ICE restart count (counter)
- TURN allocation rate, relayed bytes, and TURN share of sessions (counter/gauge)
- Permission denial rate (counter)

**Safety**

- Report rate per 1,000 sessions (gauge)
- Report category distribution (counter)
- Ban rate and appeal rate (gauge)
- Moderation action distribution (counter)
- Rate-limit trigger rate (counter)
- P0 escalation acknowledgement latency (histogram)

**Platform**

- p95/p99 latency per endpoint
- Error rate per endpoint
- Database connection pool saturation
- Retention job success/failure (counter) — **alerted**

### Alerting

Every alert has a [RUNBOOK.md](../RUNBOOK.md) entry and an owner. Safety alerts are
paged; performance alerts are ticketed.

| Alert | Severity |
| --- | --- |
| P0 escalation unacknowledged beyond threshold | Page |
| Report rate spike (statistical anomaly) | Page |
| Retention job failure | Page |
| Sessions-per-participant > 1 observed | Page |
| TURN allocation failure rate spike | Ticket |
| Match latency p95 breach | Ticket |
| WebSocket error rate spike | Ticket |
| Queue size sustained above capacity | Ticket |

### Explicitly forbidden

- Dashboards that render chat content.
- "User timelines" that reconstruct a participant's session history across identities.
- Any metric labelled with an IP address, a device identifier, or a report note.

## Consequences

**Positive**

- We can debug a distributed race without ever seeing what was said.
- Safety anomalies are first-class alerts, not afterthoughts.
- OTel keeps the backend swappable.
- Cardinality discipline keeps the cost predictable.

**Negative**

- Some debugging is genuinely harder: we cannot reconstruct a conversation to diagnose a
  complaint.
- The no-content rule must be defended on every new span, forever.
- Safety spans need elevated sampling, which has a cost.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| A contributor adds message content to a span "temporarily" | High | Medium |
| High-cardinality labels make metrics unaffordable | Medium | Medium |
| Safety anomaly is invisible because no alert exists | High | Medium |
| Trace volume overwhelms the backend | Medium | Medium |
| Observability data becomes a de facto conversation archive | High | Low |

## Mitigations

- **MR-1:** A shared tracing helper is the **only** permitted way to create spans, and it
  accepts an allowlist of attribute keys. Adding a new attribute key requires review.
- **MR-2:** A test asserts the allowlist contains no content-shaped keys and no address
  keys.
- **MR-3:** Metric labels are restricted to low-cardinality enumerations (mode, reason
  class, region, status). Enforced by review and by a cardinality lint.
- **MR-4:** The safety alert list is reviewed on a cadence with Trust & Safety; a new
  abuse pattern must come with an alert.
- **MR-5:** Sampling configuration is reviewed against cost monthly; safety spans are
  always sampled.
- **MR-6:** Observability data has its own retention tier (Tier 5, 13 months) and is
  access-controlled separately from application data.

## Revisit Conditions

- Trace volume makes the backend cost prohibitive → tighten sampling before reducing
  coverage.
- We add media → media-quality metrics are needed, but media content still must never be
  captured.
- A privacy audit finds observability data being used beyond operations → access controls
  are tightened and this ADR is revisited.
- We move to multi-region → add region as a label and revisit trace propagation.

## References

- [OBSERVABILITY.md](../OBSERVABILITY.md)
- [PERFORMANCE.md](../PERFORMANCE.md)
- [RUNBOOK.md](../RUNBOOK.md)
- [OPERATIONS.md](../OPERATIONS.md)
- [ADR-010](ADR-010-moderation-model.md)
- OpenTelemetry — https://opentelemetry.io/
