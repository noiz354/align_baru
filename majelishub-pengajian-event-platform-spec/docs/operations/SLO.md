# SERVICE LEVEL OBJECTIVES

Judgment-based targets, expressed with the exact metric that proves them. Every SLO must map to one
dashboard panel, one alert and one runbook section (`OBSERVABILITY.md` §11). These are *internal*
objectives — the product makes **no public uptime promise**, because a mosque's kajian must proceed
whether or not the software is available, and that is what the manual fallback is for.

Measurement: all windows are rolling; SLIs are computed from the metrics in `OBSERVABILITY.md` §4.

---

## 1. Participant-facing (the room)

| ID | SLO | Target | Window | SLI (metric) | Alert | Runbook |
|---|---|---|---|---|---|---|
| SLO-01 | Check-in commit availability | ≥ 99.9% | 30 d | `1 − (checkin_total{result=UNAVAILABLE} / checkin_total)` | `CHECKIN_FAILURE_RATE_HIGH` | RB-01 |
| SLO-02 | Check-in latency | p95 ≤ 300 ms | 30 d | `checkin_duration_ms` | `CHECKIN_LATENCY_HIGH` | RB-01 |
| SLO-03 | Registration availability | ≥ 99.5% | 30 d | `1 − (registration_total{result=ERROR} / registration_total)` | — (page-level 5xx alert) | RB-08 |
| SLO-04 | Public page availability (event/archive) | ≥ 99.5% | 30 d | `http_request_duration_ms{route=/kajian/*, status<500}` | page 5xx alert | RB-08 |
| SLO-05 | Code retrieval (participant sees their code) | ≥ 99.9% | 30 d | derived from code-endpoint success | — | RB-01 |

Rationale for 99.9% on check-in: the entrance is the one place where failure is visible to a crowd.
The manual path makes a degraded mode survivable, but a degraded mode is not an excuse for a lower
target.

## 2. Organizer-facing

| ID | SLO | Target | Window | SLI | Alert |
|---|---|---|---|---|---|
| SLO-06 | Attendance summary freshness | ≤ 5 s after a check-in | — | derived from commit + cache invalidation | — |
| SLO-07 | Notification dispatch within promise | 95% of essential intents dispatched ≤ 5 min of creation | 7 d | `notification_dispatch_duration_ms` | `NOTIFICATION_FAILURE_RATE_HIGH` |
| SLO-08 | Notification success rate | ≥ 98% per channel | 7 d | `notification_failures_total` ratio | `NOTIFICATION_FAILURE_RATE_HIGH` |
| SLO-09 | Dashboard load | p95 ≤ 2 s | 7 d | `http_request_duration_ms{route=/kelola/*}` | — |

## 3. Media pipeline

| ID | SLO | Target | Window | SLI | Alert |
|---|---|---|---|---|---|
| SLO-10 | Chunk acceptance success (after retries) | ≥ 99.9% of chunks eventually accepted | per session | `upload_chunk_total{result=ACCEPTED|RETRIED|FAILED}` | `AUDIO_UPLOAD_FAILED` |
| SLO-11 | Assembly time for a 2-hour session | ≤ 3 min, p95 | 30 d | `audio_assembly_duration_ms` | — |
| SLO-12 | Processing (normalise + derive) for 2 h audio | ≤ 10 min, p95 | 30 d | `audio_process_duration_ms` | `AUDIO_PROCESSING_FAILED` |
| SLO-13 | Recording session integrity | ≥ 99% of completed sessions have zero unexpected gaps > 2 s | 30 d | `recording_gap_sessions_total / recording_sessions_total` | `AUDIO_RECORDING_INTERRUPTED` |
| SLO-14 | Asset readiness after session end | 90% `READY` ≤ 30 min (venue network permitting) | 30 d | session state age | — |

## 4. Transcription

| ID | SLO | Target | Window | SLI | Alert |
|---|---|---|---|---|---|
| SLO-15 | Transcription job completion (excluding provider outages) | ≥ 95% | 30 d | `transcription_jobs_total` ratio | `TRANSCRIPTION_FAILED` |
| SLO-16 | Queue age | p95 ≤ 2× audio duration | 7 d | `transcription_queue_age_s` | `TRANSCRIPTION_QUEUE_AGING` |
| SLO-17 | Review turnaround (organizational objective) | 90% of drafts reviewed ≤ 7 days | 30 d | `transcript_review_age_s` | `TRANSCRIPT_REVIEW_REQUIRED` |

SLO-17 is explicitly an *organizational* objective: the system cannot make a human review faster, and
it must never be "met" by publishing unreviewed text.

## 5. Platform

| ID | SLO | Target | Window | SLI | Alert |
|---|---|---|---|---|---|
| SLO-18 | 5xx rate | ≤ 0.1% of requests | 30 d | `http_request_duration_ms{status>=500}` | page 5xx alert |
| SLO-19 | Job success (after retries) | ≥ 99% | 30 d | `job_failures_total` ratio | `JOB_BACKLOG_HIGH` |
| SLO-20 | Database availability | ≥ 99.9% | 30 d | health checks | `DB_POOL_SATURATED` / RB-08 |
| SLO-21 | Storage availability | ≥ 99.9% | 30 d | `storage_operation_duration_ms` errors | `STORAGE_UNAVAILABLE` |
| SLO-22 | Retention job freshness | each policy run ≤ 24 h | 30 d | `retention_run_age_s` | `RETENTION_RUN_STALE` |
| SLO-23 | Backup restorability (proven, not assumed) | 100% of monthly drills pass | monthly | drill record | backup alert |
| SLO-24 | Telemetry privacy guardrail | 0 dropped-attribute events | 7 d | `telemetry_dropped_attribute_total` | `TELEMETRY_ATTRIBUTE_DROPPED` |

## 6. Error budget policy

1. Budget consumed per SLO = (1 − target) over the window.
2. **50% consumed:** the next release includes a hardening item for that path; new features touching
   the path require a written risk note.
3. **100% consumed:** feature work on that path stops until the cause is fixed and the SLO holds for
   one full window. Exceptions require the platform administrator to record the reason.
4. Budgets for SLO-01/SLO-02 are evaluated **per event**, because an outage outside event hours has
   no user impact — a fair measurement of what matters.
5. Never "meet" an SLO by hiding failures: if a request fails, the metric records a failure even when
   the user retried successfully.

## 7. Exclusions (documented, not hidden)

| Excluded from SLO | Reason |
|---|---|
| Venue-side network failures (participant device offline) | Outside our control; the manual path covers it; counted separately for awareness |
| Provider outages (email, hosted STT) | External; we measure our handling, and adaptation (queueing/retry) has its own SLO |
| Scheduled maintenance windows | Announced ≤ 7 days ahead; never during a registered event |
| Browser/device below the support matrix | Documented supported set; `DESIGN-SYSTEM.md` support matrix |
| Transcription accuracy | Not an uptime property; accuracy is a *review* concern (ADR-0012) — never an SLO, to avoid incentivising unreviewed publication |
