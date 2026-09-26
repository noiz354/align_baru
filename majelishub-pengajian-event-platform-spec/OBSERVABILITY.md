# OBSERVABILITY

What we measure, what we log, what we alert on — and the hard rules about what must never enter
telemetry.

Requirements: NFR-OBS-001…008 · ADR-0019 · SLOs: `docs/operations/SLO.md` · Performance budgets:
`PERFORMANCE.md`

---

## 1. Why observability is designed around failure modes, not vanity

The system fails in ways that are invisible from a server dashboard: a volunteer's uploads quietly
backing up during a 2-hour recording; a mosque entrance where every third scan fails because the
device is on the wrong event; a transcription provider silently returning half a transcript. Each of
those must be visible **in the product** (to the operator) and **in telemetry** (to the SRE), with a
shared vocabulary so the two conversations are the same conversation.

## 2. Signals

| Signal | Purpose | Retention | Content rules |
|---|---|---|---|
| Structured JSON logs (stdout) | Debuggable narrative per request/job | 30 days | Allow-listed attributes only (never PII/content/tokens) |
| OpenTelemetry traces (OTLP) | Latency and dependency analysis across HTTP, DB, storage, jobs | 7 days (sampled) | Span names + ids + sizes + outcomes |
| OpenTelemetry metrics | Rates, histograms, saturation; alert inputs | 90 days | Counters/histograms with low-cardinality attribute sets |
| Audit events (database) | Accountability, incident reconstruction | 7 years | Never in telemetry; queried through the audit UI |
| Product dashboards | Organizer-facing operational truth | per feature | Aggregates only |

## 3. Correlation

- `requestId` (ULID) generated at the edge, attached to logs, traces and error responses.
- `traceId` propagated to job payloads so a background job can be traced to the request that
  enqueued it; `causationId` links events (`EVENTS.md` §2).
- Domain ids (`eventId`, `registrationId`, `sessionId`, `organizationId`) are the join keys between
  the product dashboards and telemetry. They are opaque and carry no personal data.
- Every log line includes: `level`, `msg`, `requestId?`, `traceId?`, `organizationId?`, `jobKey?`,
  `durationMs?`, `outcome?`.

## 4. Metrics catalogue (authoritative names)

Naming: `<domain>_<subject>_<unit>`; dimensions are low-cardinality (`result`, `method`, `channel`,
`kind`, `policyKey`) — **never** ids of people or events as label values.

### Registration
- `registration_total{result=REGISTERED|WAITLISTED|REJECTED_CLOSED|REJECTED_FULL|DUPLICATE|ERROR}`
- `registration_duration_ms` (histogram)
- `capacity_contention_total{result=WON|WAITLISTED|REJECTED}`

### Check-in
- `checkin_total{result=VALID|ALREADY|INVALID_TOKEN|INVALID_FORMAT|WRONG_EVENT|EXPIRED|CANCELLED|WINDOW_CLOSED|UNAVAILABLE}`
- `checkin_duration_ms` (histogram, p50/p95/p99)
- `checkin_manual_total{method=SHORT_CODE|NAME_LOOKUP|WALK_IN|CORRECTION}`
- `checkin_duplicate_scan_total` (abuse/UX signal)
- `checkin_device_switch_total`

### Attendance
- `attendance_records_total{method}`
- `attendance_corrections_total{action}`
- `attendance_stats_drift_total` (reconciliation failures — must be 0)

### Recording & media
- `recording_sessions_total{result=COMPLETED|FAILED|ABANDONED|RECOVERABLE}`
- `recording_duration_ms` (histogram)
- `recording_chunk_gap_ms_total` and `recording_gap_sessions_total` (sessions with > 2 s of gaps)
- `upload_chunk_total{result=ACCEPTED|RETRIED|FAILED|CONFLICT}`
- `upload_backlog_chunks` (gauge, per active session; exported as histogram buckets for alerting)
- `upload_chunk_duration_ms` (histogram)
- `audio_assembly_duration_ms`, `audio_process_duration_ms` (histograms)
- `audio_processing_failures_total{stage=ASSEMBLE|NORMALIZE|DERIVE}`

### Transcription
- `transcription_jobs_total{provider,result=COMPLETED|FAILED|DEAD}`
- `transcription_duration_s` (histogram, by provider)
- `transcription_queue_age_s` (gauge)
- `transcript_review_age_s` (gauge: time since REVIEW_REQUIRED) — drives the review SLA alert
- `transcript_approvals_total{role}` · `transcript_publications_total`

### Notifications
- `notification_intents_total{templateKey,class}`
- `notification_failures_total{channel,errorCode}`
- `notification_dispatch_duration_ms`
- `notification_dead_letter_total{channel}`

### Platform
- `http_request_duration_ms{route,method,status}` (route templates only, never raw paths with ids)
- `job_duration_ms{queue,outcome}` · `job_failures_total{queue,errorCode}`
- `db_query_duration_ms{operation}` · `db_pool_saturation`
- `storage_operation_duration_ms{op=PUT|GET|HEAD|DELETE}`
- `retention_deleted_total{policyKey}` · `retention_failures_total{policyKey}` · `retention_run_age_s`
- `telemetry_dropped_attribute_total` (the guardrail counter — must be 0 in normal operation)
- `rate_limit_rejections_total{route}`
- `slo_burn_rate{slo}` (see `docs/operations/SLO.md`)

## 5. Structured logging rules

```jsonc
{ "level": "info", "msg": "checkin.committed", "requestId": "01J…", "traceId": "…",
  "organizationId": "0a…", "eventId": "9f…", "attendanceId": "c1…", "result": "VALID",
  "method": "QR", "durationMs": 84 }
```

Rules:

1. One `logger` module is the only logging interface; `console.*` is banned outside bootstrap
   (`T-OBS-002`).
2. Log **outcomes and ids**, never payloads. Request bodies are not logged.
3. Errors log `errorCode` and a stack (server-side only), never the invalid input value.
4. Job logs include `queue`, `jobId`, `attempt` and outcome.
5. Log levels: `error` (needs a human), `warn` (degraded but handled), `info` (state changes on
   critical paths), `debug` (off in production by default).

## 6. Traces

Span naming convention: `<domain>.<operation>`.

| Span | Key attributes |
|---|---|
| `checkin.validate` | `organizationId`, `eventId`, `result`, `method`, `cacheHit=false` |
| `checkin.commit` | `attendanceId?`, `duplicate` |
| `registration.create` | `eventId`, `result`, `capacityRemaining` (bucketed) |
| `recording.chunk.upload` | `sessionId`, `sequence`, `sizeBytes`, `result` |
| `audio.assemble` | `sessionId`, `chunkCount`, `gapCount`, `bytes` |
| `audio.process` | `sessionId`, `operation`, `durationMs` |
| `transcription.submit|poll|fetch|segment` | `jobId`, `providerId`, `durationMs` |
| `transcript.revision.save` | `transcriptId`, `revisionNumber`, `changedSegments` |
| `notification.dispatch` | `intentId`, `channel`, `templateKey`, `result` |
| `storage.put|get|sign` | `op`, `bytes`, `result` |
| `db.tx` | `operation`, `rowsAffected` (bucketed) |

Sampling: head-based default 10%; **100% for `checkin.*` and `recording.chunk.upload` during event
hours** (temporary flag per event day), because those are the paths that must be diagnosable from a
single volunteer's report.

## 7. Forbidden in telemetry (hard rule; enforced by the allow-list)

| Never | Why |
|---|---|
| Tokens, short codes, invitation codes | Credentials |
| Names, phone numbers, emails, contact hashes | Personal data |
| Transcript text, feedback text, event descriptions | Content personal to the speaker/participant |
| Audio bytes, dimensions of audio content | Content |
| Presigned URLs | Bearer credentials |
| Provider payloads | May contain content |
| Raw IP addresses | Personal data (hashed with a rotating salt if needed for abuse signals) |
| Precise geolocation | Not collected at all for participants |

The logger/tracer drop unknown attributes and increment `telemetry_dropped_attribute_total`, so a
violation is **visible** rather than silent.

## 8. Organizer dashboards (conceptual; no analytics implementation in Phase 0)

Priority-ordered cards (`DESIGN.md` §5.6). Each card states its definition on tap.

| Card | Content | Data source | Honesty rule |
|---|---|---|---|
| Kajian mendatang | next 7 days: registration state, capacity, check-in state | events + registrations | capacity shown only when exact |
| Perlu tindakan | recordings awaiting processing, transcripts in review, feedback unread, unresolved alerts | module counters | each item links to the action |
| Kapasitas | registered vs capacity, waitlist depth | registrations | waitlist shown separately |
| Kehadiran | checked-in, walk-in, no-show (window closed only), method mix | attendance | no-show labelled "belum check-in" before window close; data-quality note when manual > 10% |
| Rekaman | status per event (none / recording / uploaded / processing / ready / failed) | recording sessions + assets | failed/partial states explicit; "recaman kosong" flagged |
| Transkripsi | job status, review age, provider | transcription jobs | review SLA visible ("perlu ditinjau 3 hari") |
| Umpan balik | response count/rate, dimension scores, comments needing action | feedback aggregate | n < 5 suppressed; no speaker comparison |
| Operasional | active alerts (deduplicated, acknowledgeable) | operational alert table | actionable only |

## 9. Operator dashboards (platform-level)

- **Health:** request rates, error rates, p95 latency per route, DB pool saturation, job backlog per
  queue, storage growth rate.
- **Media:** active recording sessions, backlog distribution, gap rates, assembly/normalisation
  durations, failure counts.
- **Transcription:** queue age, provider success/error codes, duration distribution, review backlog
  and age, cost proxy (minutes processed).
- **Messaging:** intents by template, failures by channel, dead-letter counts.
- **Data protection:** retention run ages and outcomes, deletion records, export counts.
- **Security:** rate-limit rejections, duplicate-scan rates, invalid-token rates, admin action feed.

## 10. Alerts (actionable, deduplicated, few)

Rule: an alert exists only if a named human action follows. Alerts carry a **dedupe key**, are
acknowledgeable, and auto-resolve.

| Alert key | Severity | Condition | Action |
|---|---|---|---|
| `CHECKIN_FAILURE_RATE_HIGH` | critical | `checkin_total{result=UNAVAILABLE|INVALID_TOKEN}` > 5% for 5 min during an event | Check DB/network; instruct entrance to manual path |
| `CHECKIN_LATENCY_HIGH` | warning | p95 `checkin_duration_ms` > 500 ms for 5 min during an event | Check DB load; scale/optimise |
| `CHECKIN_SCANNER_STALLED` | warning | A bound device reports no scans for 10 min during an open window | Contact the volunteer |
| `DUPLICATE_SCAN_RATE_HIGH` | warning | `checkin_duplicate_scan_total` > 5% of check-ins for an event | Consider manual verification; check for token sharing |
| `AUDIO_RECORDING_INTERRUPTED` | critical | `recording_gap_sessions_total` or a session with `DEVICE_LOST`/`ENCODER_STALL` | Operator notified in-app immediately; investigate device |
| `AUDIO_UPLOAD_FAILED` | critical | `upload_chunk_total{result=FAILED}` > threshold or backlog > 20 chunks for 3 min | Operator notified; check connectivity/storage |
| `AUDIO_PROCESSING_FAILED` | warning | `audio_processing_failures_total` increases | Inspect job error; retry; verify ffmpeg version |
| `STORAGE_UNAVAILABLE` | critical | storage ops failing > 1% | Fail closed on writes; investigate provider |
| `TRANSCRIPTION_FAILED` | warning | provider failures > 20% over 30 min | Check provider config/quota; retry later |
| `TRANSCRIPTION_QUEUE_AGING` | warning | `transcription_queue_age_s` p95 > 2× audio duration | Investigate worker capacity |
| `TRANSCRIPT_REVIEW_REQUIRED` | info | `transcript_review_age_s` > 7 days for any transcript | Notify organizer/reviewer; offer to reassign |
| `EVENT_STARTING_SOON` | info | 30 min before an event with a recording policy but **no** recording session started | Prompt the audio operator |
| `CAPACITY_NEAR_LIMIT` | info | registrations ≥ 90% of capacity | Organizer decides waitlist/extra session |
| `NOTIFICATION_FAILURE_RATE_HIGH` | warning | `notification_failures_total` > 10% over 30 min | Check provider; dead-letters reviewed |
| `RETENTION_RUN_STALE` | warning | a policy has not run in 48 h | Investigate scheduler/worker |
| `RETENTION_DELETION_FAILED` | warning | post-delete verification mismatch | Investigate storage/DB permissions |
| `JOB_BACKLOG_HIGH` | warning | any queue's waiting jobs > 100 for 15 min | Worker capacity or stuck job |
| `DB_POOL_SATURATED` | warning | pool saturation > 85% for 5 min | Investigate slow queries/connection leaks |
| `TELEMETRY_ATTRIBUTE_DROPPED` | warning | `telemetry_dropped_attribute_total` > 0 | Fix the offending log/attribute (privacy guardrail) |
| `SECRET_EXPOSURE_SUSPECTED` | critical | regex match for token patterns in logs (scanner) | Rotate affected secret; incident procedure |

Alert design rules: thresholds are derived from the SLOs; every alert lists its runbook section
(`RUNBOOK.md`); alerts during an event take precedence over nightly maintenance noise; informational
alerts go to the organizer's dashboard rather than a pager.

## 11. SLO mapping

Each SLO in `docs/operations/SLO.md` must have: one metric (or ratio), one dashboard panel, one
alert with an error budget policy. A quarterly review checks the mapping and prunes alerts that never
fire or always fire.

## 12. What we deliberately do not build

1. **No session replay / heatmaps** on any surface (records participant screens; privacy-hostile).
2. **No third-party analytics scripts** (`FR-ANALYTICS-004`).
3. **No per-user behaviour timelines** — telemetry is operational, not behavioural.
4. **No alert on single events** (a single invalid scan is not an incident) — alerts operate on rates
   and windows to avoid noise, with the documented exceptions that are genuinely urgent
   (`AUDIO_RECORDING_INTERRUPTED`).
5. **No log-based metrics for content** (we never need to count words spoken).
