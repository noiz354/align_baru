# OBSERVABILITY.md — Signals, Instrumentation & Thresholds

> 2026-09-26 · Status: **SPECIFIED, NOT IMPLEMENTED** · Decision record: ADR-015 · Operations usage: OPERATIONS.md, RUNBOOK.md.
> Constraint that shapes everything here: **no household content in telemetry, ever** (PRIVACY.md §5).

## 1. Signals we emit

| Signal | Transport | Stable in 2026? | Purpose |
| --- | --- | --- | --- |
| Structured logs | JSON lines to stdout | n/a (our own wrapper) | Event-level detail for diagnosis |
| Traces | OpenTelemetry SDK 2.x → OTLP (optional) | Yes (traces stable in JS) | Latency attribution across request → service → DB |
| Metrics | OpenTelemetry metrics → OTLP (optional) | Yes (metrics stable in JS) | Rates, error ratios, queue/tick health |
| Health endpoints | HTTP `/api/health` | n/a | Liveness/readiness for the platform and the operator |
| Audit log | Postgres table | n/a | Security-relevant accountability (NFR-SEC-009) |

Explicitly **not** used: browser analytics, session replay, product funnels, OTel logs SDK (still in Development for JS in 2026 — see docs/research/STACK-2026.md#8).

## 2. Log contract

```ts
type LogEvent = {
  event: string;                 // stable, snake-case: "chore.completed"
  level: 'debug' | 'info' | 'warn' | 'error';
  requestId?: string;            // correlation id, per request or job run
  traceId?: string;
  householdId?: string;          // opaque id ONLY
  actorId?: string;              // opaque id ONLY
  entityType?: 'room'|'chore'|'occurrence'|'trash_container'|'resource'|'asset'|'plan'|'issue'|'alert'|'member'|'household';
  entityId?: string;
  outcome?: 'ok'|'rejected'|'failed'|'suppressed';
  errorClass?: string;           // typed error code name, never a message with user content
  durationMs?: number;
  count?: number;                // aggregates only
  channel?: 'in_app'|'push'|'email';
  job?: string;
};
```

Rules:
- The logger takes **only** this typed object — there is no arbitrary-payload overload (structural redaction, ADR-015).
- No names, emails, titles, notes, comments, storage keys, tokens, or endpoints.
- One event per meaningful outcome; failures always log with `outcome: 'failed'` and `errorClass`.
- Levels: `error` = something a human may need to fix; `warn` = degraded but recoverable; `info` = lifecycle events; `debug` = dev only (still redaction-typed).

## 3. Span map (named boundaries)

| Span | Parent | Attributes (allowed) | Notes |
| --- | --- | --- | --- |
| `http.request` | — | method, route template (not raw url), status, duration | Auto-instrumented where possible |
| `op.<module>.<action>` | `http.request` | module, action, outcome, householdId? | One span per use case (API.md operations) |
| `auth.session` | `op.*` | outcome (`ok`/`missing`/`expired`/`revoked`) | No identifiers |
| `auth.authorize` | `op.*` | requiredRole, outcome | Denials are the interesting case |
| `db.query` | `op.*` | operation name (`select`/`insert`/`update`), table (bounded set), duration | Raw SQL text is **not** attached |
| `db.transaction` | `op.*` | outcome, duration | |
| `scheduler.tick` | — | job, outcome (`ran`/`skipped_locked`/`failed`/`timeout`) | |
| `scheduler.job` | `scheduler.tick` | job, householdsProcessed, itemsProcessed | |
| `alerts.evaluate` | `scheduler.job` | created, refreshed, resolved counts | Counts only |
| `notifications.decide` | `alerts.evaluate` | intentsCreated, suppressed, reasons counts | |
| `notifications.deliver` | `op.*` / `scheduler.job` | channel, outcome, attemptNumber | No endpoint, no payload |
| `recurrence.materialise` | `scheduler.job` | created, skippedExisting | |

Sampling: parent-based, 100% for requests and scheduler jobs at our volume; a documented env knob reduces it if ever needed (ADR-015).

## 4. Metrics catalogue

| Metric | Type | Labels (bounded) | Purpose / threshold |
| --- | --- | --- | --- |
| `http_requests_total` | counter | route, method, status_class | Error ratio; alert if 5xx > 1% over 15 min |
| `http_request_duration_ms` | histogram | route | p95 per PERFORMANCE.md |
| `op_duration_ms` | histogram | module, action | Mutation latency budget PB-S2 |
| `db_query_duration_ms` | histogram | operation, table | PB-S4; slow > 150 ms |
| `scheduler_tick_total` | counter | job, outcome | `skipped_locked` storms indicate lock contention |
| `scheduler_tick_age_seconds` | gauge | job | **Alert if > 15 min for 60 s jobs** |
| `scheduler_job_failures_total` | counter | job | 3 consecutive failures = operator signal |
| `scheduler_job_duration_ms` | histogram | job | PB-S5 |
| `alerts_open` | gauge | priority | Dashboard-independent view of household pressure |
| `alerts_created_total` | counter | type | Spam detection (per-day spikes) |
| `alert_fatigue_ratio` | derived | — | Delivered notifications per member per day; review trigger > 3 (ADR-008) |
| `notification_intents_total` | counter | channel, outcome | |
| `notification_suppressed_total` | counter | reason (`quiet_hours`, `cap`, `away`, `channel_disabled`, `duplicate`) | Explains "why didn't I get it?" |
| `notification_delivery_duration_ms` | histogram | channel | PB-S6 |
| `notification_dead_letter_total` | counter | channel | Any increase is operator-actionable |
| `push_subscriptions_active` | gauge | — | Sudden drop = client bug |
| `auth_failures_total` | counter | reason_class, endpoint | Brute-force detection |
| `rate_limit_hits_total` | counter | operation_class | Abuse detection |
| `activity_rows_pruned_total` | counter | table | Retention health |
| `outbox_pending` | gauge | — | Backlog signal |
| `outbox_dead_letter` | gauge | — | Delivered failure signal |

**Cardinality rule:** labels must come from a closed set. No householdId, memberId, entityId, route with ids, user agent strings, or free text in metrics.

## 5. Health endpoints

| Endpoint | Checks | Response |
| --- | --- | --- |
| `GET /api/health` | Process alive | `200 {status:'ok', version, uptimeSeconds}` |
| `GET /api/health?deep=1` | DB connectivity, migration version match, last successful scheduler tick per job, outbox backlog | `200` healthy / `503` degraded with `{status, reasons:[codes]}` — codes only, no detail leaks |

Readiness semantics: degraded means "the app works but something scheduled is behind" (e.g. alert evaluation stale) — a member can still use the app; the operator should act (RUNBOOK.md).

## 6. Dashboards the operator should have

1. **Request health**: request rate, error ratio, p95 latency by route.
2. **Scheduler health**: tick age per job, failures, durations — the single most important dashboard for this app.
3. **Delivery health**: intents created/delivered/suppressed/failed, dead letters, active subscriptions.
4. **Alert volume**: open alerts by priority, created/resolved counts, per-member delivery ratio (fatigue signal).
5. **Data health**: DB size, slow queries, prune job results, backup success timestamp.

If no OTLP backend is configured, the minimum viable substitute is: `/api/health?deep=1` + stdout logs on the host (documented in RUNBOOK.md#no-exporter).

## 7. Thresholds & what they mean

| Signal | Threshold | Interpretation | Action |
| --- | --- | --- | --- |
| `scheduler_tick_age_seconds` (60 s jobs) | > 900 | Scheduler stalled or process thrashing | RUNBOOK.md#scheduler-stalled |
| `scheduler_job_failures_total` | 3 consecutive | A job is broken (code or data) | Read logs by `requestId`, fix, re-run job manually |
| `outbox_dead_letter` | > 0 | Delivery permanently failing | RUNBOOK.md#push-failures |
| `http_requests_total{status_class="5xx"}` | > 1% / 15 min | Application defect | Investigate the top `op.*` span by error |
| `notification_suppressed_total{reason="cap"}` | > 50% of intents for a week | Caps too low or alert noise too high | Revisit thresholds (ADR-008 revisit condition) |
| `auth_failures_total` | > 20 / 15 min per endpoint | Brute force or client bug | Rate limits are already in place; check source |
| `push_subscriptions_active` | −30% week over week | Client/PWA regression | Re-test registration flow |

## 8. What we deliberately do not instrument

Per-household analytics · page-view funnels · time-in-app · per-member activity counts (surveillance-adjacent, PRIVACY.md PP-9) · user-content-bearing traces · client-side error reports containing DOM snapshots · third-party RUM agents.

## 9. Instrumentation obligations per task (AGENTS.md §3 item 11)

When implementing an operation, name:
1. the `op.<module>.<action>` span and its outcome attribute,
2. any counter/histogram it increments,
3. the log event(s) emitted on failure,
4. whether it affects a health/readiness signal.

A task that cannot answer these for a new operation is incomplete.
