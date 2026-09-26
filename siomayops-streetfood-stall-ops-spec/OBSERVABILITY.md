# OBSERVABILITY

**Document ID:** DOC-OBSERVABILITY
**Status:** Phase 0 (plan; **no telemetry implemented**)
**Related:** NFR-OBS-*, ADR-0022, `NOTIFICATIONS.md`, `RUNBOOK.md`, `docs/research/STACK-2026.md` §2.13

---

## 1. What we need to be able to answer

| Question | Signal | Owner |
| --- | --- | --- |
| Are operators able to work right now? | Sync success rate, active shifts, client error rate | Eng + Ops |
| Is money moving correctly? | Payment state distribution, callback success, reconciliation backlog | Eng + Finance |
| Are we losing or duplicating records? | Idempotent replay counts, duplicate rejections, quarantine counts | Eng |
| Is the system fast enough in the field? | API p95, app shell load, sync batch duration on 3G-like profiles | Eng |
| Are we alerting humans usefully? | Alert acknowledgement time, resolution time, alerts per day | Ops |
| Are we violating our own rules? | Counters for "no client-side PAID", "no location report outside shift" invariants | Eng |
| What will break next week? | DB growth, job queue depth, disk, connection saturation | Eng |

---

## 2. Instrumentation plan (OpenTelemetry)

| Signal | Implementation stance |
| --- | --- |
| **Traces** | OTel JS SDK; spans for HTTP handlers, use cases, repository calls, provider adapter calls, job executions. W3C `traceparent` propagated from the PWA. |
| **Metrics** | OTel metrics (stable API): counters/histograms listed in §3. |
| **Logs** | Structured JSON via Pino with correlation IDs; shipped via OTLP **as structured logs** (OTel JS Logs API is still maturing — we do not depend on it for critical paths). |
| **Frontend** | Web-vitals-style timings (LCP, INP), sale-flow duration events (no PII), sync metrics; batch-sent, offline-buffered. |
| **Profiling** | Not in Phase 0 (OTel profiling still alpha). |

Backend: OpenTelemetry Collector → Prometheus (metrics) + Tempo (traces) + Loki (logs) +
Grafana (dashboards/alerts). Local dev uses the bundled `grafana/otel-lgtm` image; production
uses separated services or a managed backend. Vendor lock-in avoided by OTLP.

---

## 3. Metric catalogue

### 3.1 Operational (business) metrics — first class

| Metric | Type | Labels (bounded) | Alert? |
| --- | --- | --- | --- |
| `siomay.shifts.active` | gauge | area | No (dashboard) |
| `siomay.shifts.unclosed_age_minutes` | histogram | area | Yes (threshold) |
| `siomay.stalls.active` | gauge | area | No |
| `siomay.location.reports_per_hour` | counter | area | No |
| `siomay.location.stale_shift_count` | gauge | area | Yes |
| `siomay.sales.created` | counter | area, method | No |
| `siomay.sales.failed` | counter | reason | Yes (rate) |
| `siomay.sales.offline_replayed` | counter | area | No |
| `siomay.payments.created` | counter | method | No |
| `siomay.payments.pending_age_minutes` | histogram | method | Yes (TTL) |
| `siomay.payments.verified` | counter | method | No |
| `siomay.payments.callback_failed` | counter | provider, reason | **Yes (any)** |
| `siomay.payments.reconciliation_backlog` | gauge | — | Yes |
| `siomay.sync.batch_duration_ms` | histogram | connection_class | Yes (p95) |
| `siomay.sync.records_rejected` | counter | reason | Yes (rate) |
| `siomay.sync.queue_corrupted` | counter | — | **Yes (any)** |
| `siomay.closing.variance_abs_minor` | histogram | area | No (trend) |
| `siomay.expenses.flagged` | counter | category | No (trend) |
| `siomay.stock.variance_abs` | histogram | item_category | No (trend) |
| `siomay.loyalty.redemption_conflicts` | counter | — | Yes (spike) |
| `siomay.alerts.raised` | counter | code, severity | No |
| `siomay.alerts.ack_latency_seconds` | histogram | severity | Yes (P1) |
| `siomay.jobs.dead_letter` | counter | job | **Yes (any)** |
| `siomay.audit.gap_detected` | counter | — | **Yes (any)** |

**Label discipline:** labels must be bounded sets (no operator IDs, no sale IDs, no raw location
names). Personal identifiers never appear as metric labels.

### 3.2 Technical metrics

| Metric | Purpose |
| --- | --- |
| HTTP request rate / error rate / p50/p95/p99 latency by route | SLO tracking |
| DB: connection pool usage, slow queries, replication lag (if any), table sizes | Capacity |
| Job queue: depth, age of oldest item, retries, failures by job | Reliability |
| Object storage: upload failures, size distribution | Evidence pipeline |
| Provider adapter: latency, error classes, timeout rate | Integration health |
| Container: CPU, memory, restarts | Ops |
| Cost proxy: egress bytes, job counts, storage growth | Budget |

---

## 4. SLOs (initial targets)

| SLI | Target | Error budget policy |
| --- | --- | --- |
| API availability (non-5xx) | 99.5% monthly | Freeze feature work if burned > 50% |
| Sale creation p95 | ≤ 800 ms (server) | Investigate > 1.2 s |
| Sale creation p95 in field (client-observed, online) | ≤ 3 s | Investigate > 5 s |
| Sync batch success rate | ≥ 99.5% | Immediate triage below 99% |
| Callback processing | ≥ 99.9% within 60 s | Page on any signature failure |
| Job success | ≥ 99.5% (excluding dead-lettered) | Triage dead letters daily |
| HQ card freshness | ≤ 5 min p95 | Alert if lag grows |

---

## 5. Dashboards

| Dashboard | Audience | Panels |
| --- | --- | --- |
| **Field Health** | Eng + Ops | Sync success, offline queue depth, app errors by version, slowest screens |
| **Money Integrity** | Eng + Finance | Payment states, callbacks, reconciliation backlog, variance trends, audit anomalies |
| **Operations Today** | Ops | Active shifts, location freshness, unclosed shifts, alerts by severity |
| **Platform** | Eng | Latency, errors, DB, jobs, storage, cost proxies |
| **Release** | Eng | Deploy markers, error-rate deltas per version, rollback triggers |

Rule: dashboards must not show personal operational details to unauthorised roles
(NFR-OBS-005). The *same* panel may show aggregates to Ops and per-record detail only to the
roles allowed by `docs/security/PERMISSIONS.md`.

---

## 6. Alerting (infrastructure) vs operational alerts

| Aspect | Infrastructure alerts (Alertmanager) | Operational alerts (`NOTIFICATIONS.md`) |
| --- | --- | --- |
| Examples | Callback failure rate, dead letters, DB down, p95 breach, disk | Unclosed shift, cash variance, unusual expense |
| Audience | Engineering | Business roles |
| Delivery | Pager channel (later), chat, email | In-app, push, WhatsApp (optional) |
| Change process | Runbook edit + review | Alert catalogue edit + product review |

Every infrastructure alert must link to a **runbook section** (`RUNBOOK.md`) with a concrete
first action. Alerts without a runbook entry are considered incomplete.

---

## 7. Data protection in telemetry

| Rule | Detail |
| --- | --- |
| No PII in logs/metrics | Phone numbers masked; no names; no evidence contents; no customer identifiers |
| Pseudonymous IDs only where necessary | Internal UUIDs are acceptable; cross-system correlation should use them, not phone numbers |
| Sampling | Traces sampled (e.g. 10% normal, 100% errors); metrics unsampled but low-cardinality |
| Retention | Short (see `RETENTION.md` R-17/R-18) |
| Access | Engineering roles; Finance sees business dashboards, not raw traces |
| Correlated but scoped | `requestId`/`traceId` link a support ticket to logs without exposing data broadly |

---

## 8. Definition of "observable enough" for the pilot

1. An engineer can answer "why did this operator's sale fail?" for a specific request in ≤ 5 min.
2. Payment callback failures page someone (or at least alert loudly) — never silent.
3. Dead-lettered jobs and corrupted queues are visible daily.
4. Freshness/staleness is measurable per stall and shown in HQ.
5. No business KPI requires SQL access to a production database by hand to be known.
