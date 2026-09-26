# ADR-015: Observability — OTel Traces/Metrics + Structured stdout Logs, Zero Household Content

## Status
Accepted

## Date
2026-09-26

## Context
A one-developer, self-hosted app has a specific operational problem: when something breaks (scheduler stalled, push failing, a slow dashboard), there is nobody to ask but the logs and metrics. At the same time, the data flowing through HomeOps is unusually sensitive for its size: room names, household routines, member names, issue descriptions, and photos (PRIVACY.md). Standard "log everything, ship it to a vendor" practices are therefore unacceptable by default. In 2026, OpenTelemetry for JavaScript has **stable traces and metrics** but its **logs signal is still in Development** — a decisive fact for how we instrument.

## Problem
What observability should HomeOps emit, through which transports, with what redaction guarantees, so that an operator can diagnose scheduler, notification, alert and authentication failures without exporting household content to a third party?

## Decision Drivers
- Diagnosability of the four named failure classes (NFR-OBS-003): scheduler, notification delivery, alert evaluation, authentication.
- Strict no-PII/no-content rule (NFR-PRIV-003, NFR-OBS-006) that is enforceable in code, not by convention.
- Vendor neutrality: no lock-in, ability to run with **no external backend** at all.
- Proportionality: household-scale traffic does not justify APM-scale cost or instrumentation.
- Stable APIs only — no reliance on experimental OTel logs packages.

## Options Considered
1. **Structured JSON logs to stdout + OTel traces/metrics (stable SDK 2.x) with optional OTLP export, zero content by default.**
2. **Heavy APM vendor SDK (Sentry/Datadog/New Relic) everywhere** — quick value, but ships household metadata to a third party, adds bundle/runtime weight, and creates a vendor dependency for a 2–10 person app.
3. **Metrics only (Prometheus endpoint)** — good signals, weak for request-level debugging ("why was this action slow?").
4. **Logs only** — workable but leaves no latency/error-rate signals; multi-step diagnosis is guesswork.
5. **OTel for everything including logs** — would mean depending on experimental JS logs SDK and its breaking changes; rejected on stability grounds.
6. **No observability** — cheapest; guarantees undiagnosable failures at 2 a.m., which contradicts NFR-OBS-003.

## Decision
Adopt **(1)**.

Concretely:
- **Logs**: JSON lines to stdout via a thin wrapper (`src/server/telemetry/logger.ts`) exposing `log.info/warn/error(event, fields)` where fields are *structured and typed by allow-list*. Required fields: `event`, `requestId`, `traceId?`, `householdId?` (opaque id only), `actorId?` (opaque id only), `entityType`, `entityId`, `outcome`, `durationMs`. Forbidden: names, emails, titles, notes, photo paths, free text of any kind.
- **Redaction is structural**: the logger accepts only a typed field object; there is no `log(obj)` overload that accepts arbitrary payloads, so "accidental PII" requires a deliberate type change.
- **Traces**: OTel SDK 2.x with auto-instrumentation for HTTP and the Postgres driver, plus manual spans at named boundaries (see OBSERVABILITY.md#spans): request handling, feature service execution, repository batch, scheduler job, notification delivery attempt, alert evaluation pass.
- **Metrics**: counters/histograms for HTTP requests, DB query duration, scheduler runs by job/outcome, notification attempts by channel/outcome, alerts created/resolved by type, auth failures by reason. Cardinaility is bounded — **no household id, member id or label with unbounded values in metrics** (aggregate only).
- **Correlation**: every request and job run gets a `requestId`; the trace id is propagated into logs. Client-facing error pages show the correlation id so a member can report it (DESIGN §11 E-5).
- **Export is optional**: with no `OTEL_EXPORTER_OTLP_ENDPOINT` configured, the SDK uses a no-op/console exporter — the app runs perfectly with zero observability backend (matches ADR-016 self-hosting).
- **Sampling**: parent-based, default 100% for requests under our volume, with a documented lever to reduce; scheduler jobs sampled at 100% (low volume, high importance).
- **No client-side analytics**: no session replay, no heatmaps, no product analytics (PRIVACY.md).
- **Health endpoints**: `/api/health` (liveness: process up) and readiness including DB connectivity and last scheduler tick age (NFR-OBS-004).
- **Retention**: log retention is the operator's choice; the app itself prints nothing beyond stdout, so retention is a deployment concern (documented in OPERATIONS.md).

## Consequences

### Positive
- One instrumentation story for traces, metrics and logs with stable APIs.
- No vendor required; can run "dark" for a hobby deployment and be upgraded to a full backend by setting an env var.
- Structural redaction makes PII leakage a type error rather than a review failure.
- Correlation ids make member-reported problems ("the chore button said error 8f3a") tractable.
- Bounded metric cardinality keeps the cost predictable.

### Negative
- Hand-written logger is less featureful than Pino (no transports, no child loggers beyond a simple context wrapper) — accepted for control and size.
- No log shipping: if the container is destroyed, logs are gone unless the operator configures collection.
- OTel auto-instrumentation can add startup time and bundle weight on the server; must be measured (PERFORMANCE.md).
- Metrics without household/member labels limits per-household debugging; acceptable given the alternative (cardinality explosion and privacy).
- OTel JS ecosystem churn (SDK 2.x was a breaking major) imposes upgrade attention.

## Risks
| Risk | Impact |
| --- | --- |
| A developer logs a raw object | PII in logs (privacy incident) |
| Scheduler metrics missing | Silent staleness |
| OTel instrumentation slows cold start | Action latency regression |
| Log volume from verbose debug | Cost/noise in production |
| No exporter configured, operator assumes visibility they do not have | Blind spots |

## Mitigations
- Logging API shape prevents arbitrary payloads; code review checklist includes "no new logger overloads" (AGENTS.md).
- Scheduler/job metrics are part of each job skeleton's documented obligations (`src/server/scheduler/jobs/*`).
- Performance of instrumentation is verified in the E2E/load smoke test (T-PERF-002) with budgets in PERFORMANCE.md.
- Log levels are configured by env (`LOG_LEVEL`), defaulting to `info`; `debug` is opt-in and still redaction-typed.
- RUNBOOK.md states explicitly what is visible without an exporter and how to enable OTLP export.

## Revisit Conditions
- OTel JS logs reach stable status → consider consolidating logs into OTel (new ADR or amendment).
- Error triage burden justifies a hosted error tracker → adopt only with a redaction adapter that strips household content.
- Traffic grows enough that 100% sampling is expensive → tune sampling per span type.

## References
- PRD.md — NFR-OBS-001..008, NFR-PRIV-003
- OBSERVABILITY.md — signals, spans, dashboards, thresholds
- PRIVACY.md — logging restrictions
- docs/operations/MONITORING.md
- docs/research/STACK-2026.md#8
- src/server/telemetry/* (skeletons)
- TASKS.md — T-OBS-001..008
