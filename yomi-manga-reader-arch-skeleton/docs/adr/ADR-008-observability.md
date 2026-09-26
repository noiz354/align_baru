# ADR-008: Observability

Status: Accepted
Date: 2026-09-26

## Context

A single-VM self-hosted app needs: structured logs with correlation, traces across HTTP → service → DB → storage, RED metrics, health/readiness, error classification with alerting, and domain telemetry (reader image failures, upload duration, auth failures) — without lock-in to one APM vendor and without using experimental packages.

## Decision Drivers

1. Vendor-neutral export (OTLP) — backend swappable (local Grafana stack ↔ SaaS).
2. **Stable packages only**: `@opentelemetry/api` 1.9.1 (stable) + SDK modules 2.11.0 (stable). `@opentelemetry/sdk-node` 0.222.0 is explicitly marked experimental → not a dependency.
3. Structured logs from day one (NFR-OBS-001/006).
4. Minimal operational overhead on one VM (collector optional in v1).

## Options Considered

### Option A — OpenTelemetry (stable API + discrete SDK modules) + pino logs → OTLP

Instrument app code with `@opentelemetry/api` only; initialize tracing/metrics in `server/telemetry` using discrete SDK modules (`sdk-trace-node`, `sdk-metrics`, `resources`, `exporter-otlp-http`) + auto-instrumentation packages as available for `postgres`/HTTP. Logs: pino JSON → stdout (collected by the host) + optional OTLP logs later.

### Option B — APM SaaS SDK (Datadog/Honeycomb/New Relic)

Fast to dashboards, but: vendor SDKs have their own lifecycle (frequent majors), log format is vendor-shaped, and it breaks the self-hosted ethos. Kept OPTIONAL: a SaaS OTLP endpoint is just an env change under Option A.

### Option C — DIY logging + Prometheus client only

Tracing (cross-DB/storage spans) is the part DIY does worst; OTel gives it standardly. Rejected.

### Option D — `@opentelemetry/sdk-node` (0.222.0)

One-package convenience, but the package is flagged experimental with breaking changes possible (npm metadata). Violates the stable-only rule. Rejected.

## Decision

**Option A.**
- Code depends on `@opentelemetry/api` (1.9.x) only; everything else is `server/telemetry`'s business (boundary rule).
- Initialization: `server/telemetry/otel.ts` (skeleton now; T-OBS-001 implements) — traces (W3C context propagation via headers), metrics (pull via OTLP HTTP push in v1).
- Instrumentation targets (OBSERVABILITY.md §2): HTTP server spans, service spans for hot features, DB spans (postgres instrumentation or manual), storage spans (manual around port calls), upload-job span.
- Logs: pino 9.x, JSON to stdout, fields per OBSERVABILITY.md §3 (requestId, route, userId pseudonymous, durationMs, status). No PII (NFR-OBS-006).
- Health: `/healthz` (process) + `/readyz` (PG ping + storage head) (NFR-OBS-004).
- Export: `OTEL_EXPORTER_OTLP_ENDPOINT` env; dev = none/`DEBUG`; prod default = local collector (Prometheus + Grafana + Loki + Tempo) OR vendor endpoint — both behind the same env (NFR-OPS-002).
- Client telemetry: beacon endpoint `POST /api/v1/telemetry/beacon` (rate-limited, batched, no PII) for reader image failures (NFR-OBS-007).

## Consequences

### Positive
- Swappable backend; self-hostable with a small Grafana compose stack (DEPLOYMENT.md).
- Stable packages only → no experimental breaking changes in the app.
- Trace + log correlation via W3C trace ID in every log line.
- Alerting thresholds are documented values (OBSERVABILITY.md §5), not vibes.

### Negative
- Manual spans where auto-instrumentation is unavailable (storage) — a little boilerplate, contained in `server/`.
- OTLP HTTP push means brief metric loss on crash (acceptable at this scale; logs remain).

## Risks

- **R1:** OTel version drift (2.x minors). → Pin; upgrade in a dedicated task (NFR-SEC-013).
- **R2:** Over-instrumentation slows hot paths. → Span budget: ≤ 8 spans per request in the reader path (OBSERVABILITY.md §2.4); measured in VS-10.
- **R3:** Log PII leakage (emails in upload job names etc.). → Redaction function at the pino root (T-OBS-003) + test asserting no PII in captured logs (NFR-OBS-006).

## Mitigations

Boundary rule (only `server/telemetry` imports SDK packages); log-redaction unit tests; beacon endpoint hardened (NFR-SEC-006 rate limit, schema-validated, size-capped).

## Revisit When

- `@opentelemetry/sdk-node` reaches 1.0 → simplify init (amendment).
- A local collector becomes operational overhead we refuse → vendor OTLP endpoint (env change only).
- Logs volume justifies a log shipper (Loki in the collector stack covers v1).

## References

- docs/research/2026-stack-validation.md (observability section, refs [20][21])
- OBSERVABILITY.md (full conventions), NFR-OBS-* (PRD §7.5), DEPLOYMENT.md (collector topology)
