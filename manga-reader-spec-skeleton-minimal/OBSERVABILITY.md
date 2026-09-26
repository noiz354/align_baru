# Observability plan

Use OpenTelemetry stable tracing/metrics APIs; logs remain structured app output integrated with runtime collector. Trace HTTP request → application operation → DB/storage call with W3C trace context and generated request ID. Never use user IDs, manga/chapter IDs, URLs, email, signed URLs, page content, or query text as metric labels.

Metrics (bounded cardinality): `http.server.request.duration`, `http.server.request.count`, `db.client.operation.duration`, `storage.operation.duration`, `reader.page.load.duration`, `reader.page.load.failure`, `reader.chapter.open.duration`, `upload.processing.duration`, `upload.rejected.count`, `auth.failure.count`, `rate_limit.rejected.count`. Dimensions limited to route template, status family, operation, error code class, asset format, and coarse result. Histogram buckets and SLO alerts set during deployment.

Logs: timestamp, severity, service/version/environment, trace_id, request_id, stable error code, route template, safe actor category. Redact secrets/credentials, authorization headers, cookies, signed query strings, free text and exact reading history. Audit events are separate access-controlled data with actor/resource/action/outcome and minimal metadata, not general logs.

Alert on availability/error budget burn, server p95, DB pool saturation/latency, storage failure, image failure rate, upload backlog/duration/rejections, auth abuse, backup failure and disk/memory pressure. Define SLO ownership, dashboard, retention, access and sampling policy before production. Client telemetry requires privacy review and opt-out/legal assessment.
