# Monitoring

> Companion to OBSERVABILITY.md (what the app emits), RUNBOOK.md (what to do), OPERATIONS.md (routine). This file is the **operator's signal inventory**: exact names, healthy ranges, and how to check them with no vendor.
> Principle: an observability stack that requires a second vendor to diagnose is not observability for a one-person operation. Everything here is answerable with `curl`, `docker logs`, and `psql`.

## 1. The four layers, cheapest first

| Layer | Question it answers | Cost | Always available |
| --- | --- | --- | --- |
| Health endpoint | Is it up, is the DB reachable, is scheduling current? | ~0 | Yes |
| Logs (stdout JSON, allow-listed fields) | What exactly happened? | ~0 | Yes |
| Metrics (OTLP if configured; otherwise computed from Postgres) | Is it trending badly? | Optional | Degrades to SQL queries |
| Traces (OTLP if configured) | Where did the 1.4 s go? | Optional | No — accept the loss |

## 2. Health signals

| Endpoint | Returns | Poll |
| --- | --- | --- |
| `GET /api/health` | `{ status: "ok", version, schemaVersion }` | External uptime check, 60 s |
| `GET /api/health?deep=1` | `{ status, db, migrations, jobs: [{name, lastTickAgeSeconds, consecutiveFailures}], outbox: {pending, deadLetters} }` | External check, 5 min (it touches the DB) |

Rules: never returns household data or row counts beyond coarse categories; responses are `no-store` and must stay under 200 ms; a degrading dependency returns `degraded` (HTTP 200) while a broken core returns `unhealthy` (503) so the uptime monitor distinguishes "wake me up" from "note it".

## 3. Metric catalogue (emitted names)

| Metric | Type | Labels (bounded) | Healthy | Investigate |
| --- | --- | --- | --- | --- |
| `http_server_duration_ms` | histogram | route, method, status_class | p95 < 400 ms | p95 > 1.2 s for 1 h |
| `op_duration_ms` | histogram | operation, outcome | p95 < 150 ms | p95 > 500 ms |
| `db_query_duration_ms` | histogram | operation, table | p95 < 30 ms | p95 > 150 ms (slow log threshold) |
| `scheduler_job_duration_ms` | histogram | job | p95 < 10 s | > 30 s |
| `scheduler_tick_age_seconds` | gauge | job | < 2× cadence | > 900 |
| `scheduler_job_failures_total` | counter | job, error_class | 0 | any 3 consecutive |
| `alerts_created_total` | counter | type, priority | matches activity | spikes without matching household activity |
| `alerts_open_total` | gauge | priority | low single digits per household | sustained growth (a signal the flows are broken) |
| `alert_transitions_total` | counter | transition | — | — |
| `notification_intents_total` | counter | channel, outcome | delivered ≈ intents − suppressed | delivered ≪ intents |
| `notification_suppressed_total` | counter | reason | mostly `QUIET_HOURS`/`CAP_REACHED` | `NO_RECIPIENT` > 0 (misconfiguration) |
| `notification_attempts_total` | counter | channel, result_class | permanent = 0 | permanent > 1% |
| `outbox_pending` | gauge | — | < 20 | > 200 for 15 min |
| `outbox_dead_letters` | gauge | — | 0 | ≥ 1 |
| `prune_rows_deleted_total` | counter | table | roughly constant | 0 for a week (job broken) |
| `auth_failures_total` | counter | reason | baseline | > 3× baseline in an hour |
| `attachments_bytes` | gauge | — | grows slowly | step changes or >80% disk |
| `db_size_bytes` | gauge | — | grows slowly | > 1 GB (revisit retention) |

**Cardinality rule:** labels are enum-like only. No household id, member id, entity id, route-with-params, or free text — ever (ADR-015, PRIVACY.md §5). The rule exists for privacy *and* for cardinality; both failures are equally fatal.

## 4. Log signals (what to grep for)

| Line to look for | Meaning | Action |
| --- | --- | --- |
| `"level":"error"` with the same `code` repeated | A real, recurring bug | Fix, then add a regression test |
| `code:"INTERNAL"` | Unexpected exception | Read the correlation id chain, then fix |
| `"job":"…","outcome":"failed"` | Scheduler trouble | RUNBOOK §2 |
| `code:"RATE_LIMITED"` spikes | Abuse or a looping client | Check the member; consider tightening |
| `code:"NOT_FOUND"` spikes on attachment routes | Probing attempt | Check source IPs; consider blocking at the edge |
| Absence of expected `job:"…","outcome":"ok"` lines | Silence is the worst signal | Health deep + RUNBOOK §2 |

Logs carry ids, codes, durations, and outcomes. They never carry titles, names, notes, or payloads (enforced by the typed logger — T-OBS-001/T-PRIV-002).

## 5. Dashboards (when an OTLP backend exists)

| Dashboard | Panels | Question |
| --- | --- | --- |
| **App health** | request rate, error rate, p50/p95/p99, deploy markers | Is the product working? |
| **Jobs** | tick age per job, duration, failures, last success | Is the background alive? |
| **Alerts** | created per type, open by priority, resolved/expired mix, per-member delivered ratio | Is the product nagging or helping? |
| **Delivery** | intents, suppressed by reason, attempts by result class, dead letters | Is the phone ringing correctly? |
| **Data** | db size, per-table growth, prune counts, attachments bytes | Is anything growing without bound? |

Without a backend: run the SQL substitutes in §6 weekly and read the numbers against the thresholds above.

## 6. No-exporter substitutes (copy-paste)

```sql
-- open alerts by priority (health of the alert loop)
SELECT priority, count(*) FROM alert WHERE state IN ('OPEN','ACKNOWLEDGED') GROUP BY 1 ORDER BY 1;

-- alerts created per day by type (spike detection)
SELECT date_trunc('day', created_at) d, type, count(*) FROM alert GROUP BY 1,2 ORDER BY 1 DESC LIMIT 40;

-- outbox health
SELECT state, count(*), max(created_at) FROM outbox_message GROUP BY 1;

-- delivery failures by class (last 24 h)
SELECT result_class, channel, count(*) FROM notification_attempt
WHERE created_at > now() - interval '24 hours' GROUP BY 1,2;

-- growth check (largest tables)
SELECT relname, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 10;
```

> Verified against a real database in T-OBS-008 before this page is trusted; until then, treat the column names as the intent, not the proof.

## 7. Alert rules (operator-facing, not household-facing)

| Rule | Condition | Severity | Notify |
| --- | --- | --- | --- |
| Site down | external probe fails twice | page | immediately |
| Health unhealthy | `/api/health?deep=1` returns 503 | page | immediately |
| Job stalled | `scheduler_tick_age_seconds > 900` | page | immediately |
| Dead letter | `outbox_dead_letters ≥ 1` | ticket | same day |
| Error rate | 5xx > 1% for 15 min | page | immediately |
| Disk | < 20% free | ticket | same day |
| Backup missing | no backup artifact in 26 h | page | immediately |
| Alert volume | per-member delivered p95 > 3/day for 3 days | product review | next routine |
| Auth failures | > 3× baseline for 1 h | ticket | same day |

The **alert volume** rule is the product's own grade: if HomeOps starts nagging its members, the operator is the first person who should know.

## 8. Noise discipline

- Every rule above has an owner (the operator) and is reviewed quarterly; a rule that fired 5 times without action is deleted or fixed, not tolerated.
- No rule exists for a condition with no action (e.g. "any 404").
- No page is allowed for something that resolves itself.
- The operator's own alerting must be quieter than the product it runs — otherwise the lesson of ADR-008 has not been learned.
