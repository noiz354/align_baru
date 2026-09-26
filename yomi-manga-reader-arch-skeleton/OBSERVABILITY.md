# OBSERVABILITY.md

Date: 2026-09-26 · Stack: OpenTelemetry (API 1.9 stable + SDK modules 2.11 stable) + pino (ADR-008). Conventions below are normative for implementation; no telemetry code exists yet (skeletons in `src/server/telemetry`).

## 1. Signals Overview

| Signal | Transport | Default destination |
|---|---|---|
| Traces | OTLP/HTTP | local collector (Tempo) or vendor; dev: none |
| Metrics | OTLP/HTTP push (30 s) | Prometheus/collector or vendor |
| Logs | JSON → stdout | host file (dev) / Loki via collector (prod) |
| Client beacons | `POST /api/v1/telemetry/beacon` (batched, ≤ 100 events, schema-validated) | app → metrics + log |

## 2. Tracing (NFR-OBS-002)

### 2.1 Context
W3C `traceparent` propagation: incoming → span → outgoing (DB, storage). Every log line includes `traceId`/`spanId` when present (pino child binding) — log↔trace correlation (NFR-OBS-001/002).

### 2.2 Span Naming
- HTTP server: `HTTP {METHOD} {route-template}` (e.g., `HTTP GET /api/v1/manga/{slug}/chapters`).
- Service spans (only where they add cross-boundary value): `service.catalog.list`, `service.progress.save`, `service.uploads.processJob`.
- DB: auto/manual `DB {op} {table}` (e.g., `DB select manga`).
- Storage: `STORAGE {op} {bucket-class}` (e.g., `STORAGE get pages`).
- Upload job: one span `service.uploads.processJob` with event markers per phase (`phase.validating`, `phase.processing`, `phase.commit`).

### 2.3 Attributes (normative)
`http.method`, `http.route`, `http.status_code`, `db.system=postgresql`, `db.statement` (first 200 chars, parameters never), `storage.operation`, `job.state`, `user.role` (reader/admin — **no user id** in attributes; pseudonymous id allowed, NFR-OBS-006).

### 2.4 Span Budget
≤ 8 spans per request on the reader hot path (open + first pages); unbounded spans elsewhere are a review finding (mitigates R2, ADR-008).

## 3. Logging (NFR-OBS-001/006)

- JSON only (pino). Levels: `fatal/error/warn/info/debug`. Prod default `info`.
- Base fields: `time, level, msg, requestId, traceId?, spanId?, route?, method?, status?, durationMs?`.
- Authenticated context adds `userId` (pseudonymous) and `role`.
- **Redaction at the root logger:** emails → first 3 chars + `***`; any string matching secret patterns (env values) → `[REDACTED]`; upload file names truncated to 80 chars, path-stripped. Unit-tested (T-OBS-003).
- Error logs: `error` object with code + typed `errorName`; **never** a raw stack trace in user-facing responses (internal logs may include stack, PII-redacted).
- Rate: access log (1/request) + event logs (auth failures, job transitions, media failures). No per-image access logs in prod (100× volume) — media failures only.

## 4. Metrics (NFR-OBS-003/007)

Naming: `yomi_` prefix, unit suffixes per OTel conventions.

| Metric | Type | Labels | Notes |
|---|---|---|---|
| `yomi_http_server_request_duration_seconds` | histogram | route, method, status_class | RED: rate+duration |
| `yomi_http_server_request_total` | counter | route, method, status | RED: errors |
| `yomi_db_query_duration_seconds` | histogram | op, table | NFR-PERF-014 monitoring |
| `yomi_storage_operation_duration_seconds` | histogram | op, kind (pages/covers/staging) | ADR-004 latency |
| `yomi_storage_operation_bytes` | histogram | op | egress visibility |
| `yomi_process_rss_bytes`, `yomi_process_cpu_seconds_total` | gauge/counter | — | saturation (ADR-009 risk R2) |
| `yomi_auth_failures_total` | counter | reason (bad_credentials, expired, disabled, rate_limited) | NFR-OBS-007 |
| `yomi_sessions_active` | gauge | — | sweep health |
| `yomi_upload_jobs_total` | counter | state, result (ready/failed), fail_code | FR-UPLOAD-007 |
| `yomi_upload_job_duration_seconds` | histogram | kind (zip/images) | §9 PERFORMANCE |
| `yomi_upload_page_duration_seconds` | histogram | phase (decode/encode/put) | ADR-005 bottleneck |
| `yomi_reader_page_load_errors_total` | counter (from beacons) | cause (network, decode, http_status), mode | NFR-OBS-007 — the reader health signal |
| `yomi_reader_session_duration_seconds` | histogram (beacons) | mode, pages_read | engagement + perf |
| `yomi_search_query_duration_seconds` | histogram | — | NFR-PERF-005 field check |
| `yomi_media_delivery_bytes_total` | counter | format (avif/webp/jpeg) | format ladder adoption |

## 5. Alerts (NFR-OBS-005) — thresholds for the operator's pager (default = log + dashboard; page = listed)

| Alert | Condition | Severity |
|---|---|---|
| `readyz_failing` | `/readyz` 503 for > 2 min | **page** |
| `http_5xx_high` | 5xx rate > 1% of requests for 5 min (≥ 20 req) | **page** |
| `db_latency_high` | `yomi_db_query_duration_seconds` p95 > 50 ms for 10 min | warn (dashboard) |
| `upload_fail_rate_high` | failed jobs > 20% of jobs over 24 h | warn → page if > 50% over 6 h |
| `reader_image_errors_high` | beacon error rate > 2% of page loads for 30 min | **page** (storage/CDN problem) |
| `disk_usage_high` | any stateful volume > 80% | warn; > 90% **page** (ADR-009 R2) |
| `auth_spike` | auth failures > 100/10 min | **page** (T-03 pattern) |
| `process_rss_high` | RSS > 1.5 GB for 10 min | warn (upload leak signal) |

## 6. Health & Readiness (NFR-OBS-004)

- `/healthz` → 200 if process serving (no dependencies).
- `/readyz` → 200 only if: PG `SELECT 1` OK **and** storage HEAD on a canary key OK (canary object created at boot, 1 byte, private).
- Both unauthenticated, no cache, constant-time-fast (< 10 ms typical).

## 7. Correlation & Dashboards

- Request ID: `x-request-id` header (generated if absent, 128-bit hex) — echoed in response header, present in all logs for the request.
- v1 dashboards (Grafana, T-OBS-006): (1) RED overview, (2) Reader health (beacon errors, session duration, media bytes by format), (3) Upload pipeline (state funnel, durations, failure codes), (4) Saturation (RSS, CPU, disk, DB latency).

## 8. Privacy Guardrails (NFR-OBS-006)

No email, no full synopsis/chapter content, no page image content, no client IP in beacons (app-level rate limiting uses IP internally only, not exported as a label). Audit events are in PostgreSQL (append-only), **not** in the telemetry pipeline (separation of duty; NFR-SEC-012).
