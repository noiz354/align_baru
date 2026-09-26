# OPERATIONS

What "operating MajelisHub" means for the humans involved: who is on the hook for what, what happens
during a live kajian, and how the system stays honest about its own state.

Deployment mechanics: `DEPLOYMENT.md` · Procedures: `RUNBOOK.md` · Alerts: `OBSERVABILITY.md` §10 ·
SLOs: `docs/operations/SLO.md`

---

## 1. Operating model (assume one volunteer)

The primary deployment target is a mosque with **1–2 technically comfortable volunteers**, not a
platform team. Therefore:

1. Everything must be doable from a documented runbook, at 04:30, by a person who has read it twice.
2. Alerts must be actionable and few; a firehose of dashboards is a failure of design.
3. **Nothing requires a human at 03:00.** Overnight jobs are idempotent and self-healing; failures are
   retried and surfaced in the morning summary rather than paging anyone.
4. The system communicates in **plain Indonesian** to mosque staff; internal tooling may be English.

### Roles in operations

| Role | Operation duties |
|---|---|
| Platform Administrator | Configuration, flags, incidents, retention jobs, releases, secrets |
| Mosque Administrator | Event calendar, capacity, organizers, review of attendance reports, feedback follow-up |
| Kajian Organizer | Publishing readiness, session planning, notifications, transcripts review assignment |
| Audio Operator | Starting/stopping sessions, watching recording health, uploading/flushing, retry |
| Volunteer (scanner) | Entrance duty, manual entry/verification, walk-ins |
| Transcript Reviewer | Review queue, approvals, corrections with reasons |

On-call: a deployment must name at least one responsible person and one backup (documented in the
deployment's own notes, not in this repo). During a scheduled event, the **organizer is the incident
contact**; the platform administrator is contacted only for platform-level alerts.

## 2. Daily / weekly / monthly rhythm

| Cadence | Job | Owner | Evidence |
|---|---|---|---|
| Daily | Event-day checklist (below) per event | Organizer | Session states + attendance summary |
| Daily | Review alert queue and acknowledge/resolve | Admin | Alert history, acknowledged actions |
| Daily | Confirm queues drained and no dead letters | Admin | Operator dashboard |
| Weekly | Check recordings with `FAILED`/`PARTIAL`, retry or re-record | Audio operator | Asset state + organizer note |
| Weekly | Review transcripts waiting > 7 days | Organizer | Review-age report |
| Weekly | Read feedback that requires follow-up, record actions | Mosque admin | `follow_up` flags closed |
| Monthly | Retention dry-run review; confirm against the privacy notice | Admin | Dry-run report + sign-off |
| Monthly | Dependency/security patch check; apply criticals | Admin | Changelog entry |
| Monthly | Storage growth and cost review | Admin | Cost estimate |
| Quarterly | Backup restore rehearsal (two people) | Admin | Restore log |
| Quarterly | SLO review; alert pruning | Admin | SLO report |
| Quarterly | Failure drills (QA-06) | Admin + organizer | Drill records |
| Yearly | Privacy notice vs actual retention configuration check | Admin + Data Protection contact | Signed checklist |
| Yearly | Threat model review | Admin | `THREAT_MODEL.md` revision |

## 3. Event-day operations

| Moment | Action | System support |
|---|---|---|
| Day before | Publish readiness verified: venue, times, speaker, capacity, registration state; QR pages printed for those without phones | Event page + print view |
| H − 24 h | Reminders dispatched (or scheduled); check notification failures | Notification dashboard |
| H − 4 h | Organizer confirms the recording plan: will it be recorded? who operates? policy set? | Event page shows the policy statement |
| H − 60 min | Recording session started (test 30 s, verify level meter, then stop and delete the test asset) | Recorder page |
| H − 30 min | Entrance devices: open check-in, verify the context bar (event/venue/entrance/device), volume and brightness, scan one known test code | Check-in console |
| H − 10 min | Scanner volunteers briefed: manual path, what to do on failure, who to call | Check-in console help text |
| H | Check-in opens (or at the scheduled opening) | Window state |
| During | Watch flagged health errors; volunteers use the manual path for anything unusual | Live counters (rate only, no names) |
| H + end | Check-in window closed (grace period applies) | Window close control |
| +15 min | Recording stopped **after** the event ends; verify the final summary (duration, gaps, chunk state) | Recorder summary |
| +30 min | Upload flush verified; if the device is still queued, keep the page open and check connectivity | Backlog indicator |
| +2 h | Assembly/processing state confirmed `READY`; play 30 seconds from the middle to verify audio | Recorder/asset page |
| Next day | Attendance report reviewed, corrections made with reasons, transcript requested if the policy allows | Attendance + transcript pages |
| Within a week | Transcript reviewed and approved/held; feedback reviewed | Review queue, feedback report |
| Within a month | Retrospective: anything caught in retrospectives goes into the runbook or a doc PR | — |

## 4. Routine job supervision

| Job | Schedule (typical) | Failure behaviour | Operator action |
|---|---|---|---|
| `assembly` | on demand (after last chunk) | Retries; marks `ASSEMBLY_FAILED` after exhaustion | Inspect chunk list; re-trigger after fixing storage |
| `audio-processing` | on demand | Retries; asset stays `PROCESSING`/`FAILED` | Inspect error; media worker health |
| `transcription-submit` | on demand | Retries with backoff; provider outages are expected | Wait or switch provider; never edit audio to "help" the provider |
| `transcription-poll` | every minute while in flight | Timeout escalates to `FAILED` with a retry option | Retry; check quota |
| `notification-dispatch` | continuous | Retries; dead-letter after N attempts | Inspect template/intent; verify provider |
| `reconciliation` | hourly | Alerts on drift | Investigate; drift must be zero |
| `retention` | daily 02:00 venue-local | Dry-run first; failures alert | Review the report; never force-delete |
| `export-cleanup` | daily | Deletes expired exports | Verify no expired exports remain |
| `token-expiry` | daily | Marks expired tokens | — |
| `backup-verify` | daily | Alerts if no recent successful backup | Escalate immediately |

Every job must be safe to run twice and must record its run in the job history (start, end, counts,
outcome).

## 5. Data and privacy operations

| Operation | Procedure | Constraints |
|---|---|---|
| Data subject access request | Contact address → verify identity proportionately → produce an export of that person's data | ≤ 7 days target; log the request and response (not the content) |
| Erasure request | Verify identity → check legal-hold/obligations → delete or anonymise per `RETENTION.md` | Refusal reasons must be stated in writing if refused |
| Retention configuration change | Change env → restart → run dry-run → review → enable | Change requires the yearly notice check to be re-run if it shortens retention |
| Published-content withdrawal | Speaker/organizer request → unpublish with reason → keep an audit record | Never silently delete the master audio; keep an audit trail of what was published and when |
| Contact-hash revocation | Participant asks to stop being contactable | Row-level change; verification that notifications stop |
| Telemetry content audit | Sample a day of logs/metrics; search for token/PII patterns | Zero findings required; a finding is an incident |

## 6. When something breaks (triage ladder)

1. **Is a kajian live right now?** If yes, prioritize the room: the entrance must keep working
   (manual path), and the recording must keep running. Product features are not the priority; the
   people in the room are.
2. Classify: entrance / recording / upload-processing / transcription / notifications / database /
   storage / provider / security.
3. Open the matching runbook section (`RUNBOOK.md`) and follow it; do not improvise on production data.
4. Communicate with the humans affected **before** investigating deeply: volunteers get an instruction
   within 2 minutes; organizers get a status note; participants never see an internal error string.
5. Record the incident (start time, impact, actions, evidence) — this is the input to
   `docs/security/INCIDENT-RESPONSE.md` if personal data is involved.

## 7. Change management

| Change type | Requirement |
|---|---|
| Any code change | PR with requirement ID + task ID, tests, and a doc update if behaviour changed |
| Configuration change | Recorded in the change log with who/when/why; flags reversible |
| Schema change | Migration reviewed + rehearsal on a production-shaped copy |
| New processor (any third party receiving data) | ADR + privacy notice update + processor entry — **before** the first byte is sent |
| New notification channel | Template review, quiet-hours and token rules, dedupe key, allow-list |
| Retention change | Documented, dry-run reviewed, notice check |
| Adding a role/permission | `docs/security/AUTHZ-MATRIX.md` update + least-privilege review + audit entry |

## 8. Capacity and growth monitoring

Signals reviewed monthly: events per week, registrations per event, attendance per event, audio
minutes captured, storage growth per event, transcription minutes, notification volume, database size
and index bloat, job durations trending.

**Triggers to act** (documented so growth is not a surprise):

| Signal | Action |
|---|---|
| Check-in p95 approaching 300 ms at peak | Review indexes/queries; consider read scaling (not "more servers") |
| Upload backlog recurring for the same venue | Investigate venue connectivity; consider on-site caching plan |
| Assembly duration > 3 minutes for a 2-hour session | Review worker CPU/allocation |
| Storage growth requiring retention shortening | That is a **privacy-visible** change: review the notice, then apply |
| Transcription queue age growing | Add worker capacity or reduce concurrency; never skip review |
| Postgres > 70% of the instance disk | Plan a growth step with a maintenance window |

## 9. Handover and offboarding (mosque-level and platform-level)

1. Every deployment keeps a **deployment notes** file (outside this repository) with: who is
   responsible, contact list, server/host details, secret storage location, and the restore procedure.
2. Handover checklist: credentials rotated and transferred, flags documented, runbook walked through
   together, one supervised event executed by the incoming person, and the backup restore performed by
   the incoming person.
3. Departing staff are removed from all administrative roles and secrets rotated within the same day.
4. If a mosque stops using the platform: export their data, agree a deletion date, execute retention,
   and record the deletion evidence (counts only).

## 10. What operations must never do

1. **Never** edit rows directly in the database to "fix" attendance or transcripts — use the
   correction/withdrawal paths so history is preserved.
2. **Never** publish a transcript without human review, even to satisfy a deadline.
3. **Never** restore a backup over live data without an explicit incident decision and a written note.
4. **Never** delete audio or transcript data outside the retention job (except lawful erasure via the
   documented procedure).
5. **Never** send participant codes or tokens through a channel that has not been reviewed
   (`NOTIFICATIONS.md`).
6. **Never** disable the review gate, the tenancy checks, or the audit trail to unblock an event.
7. **Never** put real participant data into a test environment, a screenshot, a chat message or a
   support ticket.
