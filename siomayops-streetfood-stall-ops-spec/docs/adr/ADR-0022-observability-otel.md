# ADR-0022: Observability with OpenTelemetry + Grafana stack

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-18
- **Area:** Operations
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

We must answer operational and money-integrity questions quickly with one small team, and we must be able to change backends without rewriting instrumentation. OpenTelemetry reached CNCF graduation in 2026 with stable traces/metrics APIs.

## Decision

Instrument with the OpenTelemetry SDK (traces + metrics) and emit structured JSON logs (Pino) shipped via OTLP rather than relying on the still-maturing JS Logs API. Run a Collector that exports to Prometheus/Tempo/Loki with Grafana dashboards; use the bundled otel-lgtm image for local development only. Business KPI metrics (shifts, sync, payments, callbacks, variances) are first-class, with bounded labels and no PII.

## Consequences

Positive: vendor-neutral, one instrumentation layer, business and technical signals correlated by trace/request id. Negative: an observability stack to operate (mitigated by managed backend or a single Compose deployment); logs-as-OTLP requires care.

## Alternatives considered

Vendor agents (Datadog/New Relic) day-one (rejected: cost/lock-in before needs are known, optional later); print-style logging only (rejected: unanswerable questions); third-party RUM on the operator surface (rejected: bundle size and privacy).

## Compliance impact

Telemetry is subject to data minimisation: no PII labels, masked identifiers, short retention (RETENTION.md R-17/R-18).

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
