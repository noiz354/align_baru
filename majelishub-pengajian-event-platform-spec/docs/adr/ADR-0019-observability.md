# ADR-0019 — OpenTelemetry traces/metrics + stdout JSON logs, with strict content rules

- Status: Accepted · Date: 2026-09-26 · Deciders: SRE, Security, Privacy
- Requirements affected: NFR-OBS-001…008, NFR-PRIV-006 · Related: ADR-0020, `OBSERVABILITY.md`, `docs/operations/SLO.md`

## Context

The operations that need visibility are unusual for a CRUD app: check-in latency bursts at a
mosque entrance, chunk upload reliability over 2 hours, ffmpeg processing time, STT provider
behaviour, and duplicate-scan rates. Debugging these from unstructured logs is guesswork, and
the data being processed (voices, transcripts, contact details) is private, which makes naive
logging a privacy incident.

## Decision

1. **Vendor-neutral instrumentation**: code depends only on `@opentelemetry/api`; the SDK,
   exporter and backend are configuration.
2. **Traces (stable in the JS SDK)**: auto-instrumentation for HTTP/`pg`/fetch, plus **manual
   spans for domain-critical operations**: `checkin.validate`, `checkin.commit`,
   `registration.create`, `recording.chunk.upload`, `audio.assemble`, `audio.process`,
   `transcription.submit|poll|segmentation`, `notification.dispatch`, `retention.run`.
   Span attributes are **allow-listed** (ids, counts, durations, sizes, statuses, provider ids).
3. **Metrics (stable)**: counters/histograms for the list in `NFR-OBS-003`
   (e.g. `checkin_total{result}`, `checkin_duration_ms`, `upload_chunk_total{result}`,
   `recording_gap_ms`, `transcription_duration_s`, `job_failures_total{queue}`,
   `notification_failures_total{channel}`).
4. **Logs: structured JSON to stdout** (12-factor), with a `requestId`/`traceId` correlation
   field. We deliberately **do not** adopt the experimental JS logs SDK as the source of truth
   (`docs/research/STACK-2026.md` §15); logs are shipped by the platform (or by the collector's
   filelog receiver).
5. **Content prohibition (hard rule)**: no audio bytes, no transcript text, no feedback free
   text, no contact details, no participant names, no token values, no presigned URLs, no
   invitation codes. Log attributes pass an allow-list; anything not on the list is dropped with
   a counter increment (`telemetry_dropped_attribute_total`), so the violation is visible rather
   than silent.
6. **PII-safe identifiers**: log `eventId`, `registrationId`, `sessionId`, `organizationId`
   (opaque ids) but never join them into a "who" in logs.
7. **Sampling**: head sampling for traces at a configurable rate (default 10% in production),
   **100% for check-in and upload paths during events** (a temporary flag on event day) because
   those are the paths that must be diagnosable.
8. **Alert evaluation** reads metrics + a small number of SQL checks, produces
   `operational_alerts` rows, and is deduplicated (ADR-0015 pattern) with a cooldown.

## Alternatives considered

- **Vendor APM SDK as primary.** *Gains:* excellent UX, auto-dashboards. *Costs:* lock-in
  contrary to a self-hostable product; per-host pricing; and it tends to invite logging content.
  *Rejected as primary*, allowed as an exporter target.
- **Logs-only observability.** *Costs:* cannot answer "why was check-in p95 4 s for 3 minutes";
  no histograms; alerting requires log scraping. *Rejected.*
- **Adopt the experimental OTel logs SDK now.** *Costs:* breaking changes between minor
  versions in a component we would depend on for production debugging. *Rejected* until the
  signal is stable; the migration path is trivial (the log allow-list and schema are already
  defined).
- **Custom metrics via a bespoke endpoint.** *Costs:* reinvention, no standard tooling.
  *Rejected.*

## Consequences

**Positive:** one instrumentation API; backends swappable; the content rules are enforced by
code rather than by hope; check-in and upload failures are diagnosable with real traces.

**Negative:** manual spans must be added deliberately (they are a task in each slice, not a
follow-up); the allow-list requires maintenance when new attributes are needed; sampling
configuration adds a small operational knob.

**Neutral:** trace/metric storage cost is bounded by the content rules (no large payloads) and
sampling; retention for telemetry differs from audit (`RETENTION.md`).

## Enforcement

- A single `logger` module is the only way to log; `console.log` is banned by lint outside
  bootstrap code.
- A test asserts the attribute allow-list rejects `email`, `phone`, `token`, `text`, `transcript`
  keys (and that the drop counter increments).
- Span names are declared in one constants file so dashboards and alerts cannot drift.
- Every SLO in `docs/operations/SLO.md` must map to at least one metric and one alert
  (checked in the SLO review task).

## Revisit trigger

Reopen if: the JS logs signal reaches stable and consolidating log pipelines would reduce
operational work; or trace volume/cost becomes material (then tune sampling, not content).
