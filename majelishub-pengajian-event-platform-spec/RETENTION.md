# RETENTION

Retention is where privacy promises become real. Different data has different natural lifetimes,
and coupling them (deleting registrations because audio is deleted, or keeping tokens as long as
transcripts) is the usual mistake this document exists to prevent.

Requirements: NFR-PRIV-002/004, FR-ATTEND-008, FR-AUDIO-016, FR-FEEDBACK-008, FR-AUDIT-005 ·
Owner: SRE + Privacy · Mechanism: `retention.run` job (`src/server/jobs/retention.*`)

---

## 1. Principles

1. **Collect less, keep less.** Every policy below is a maximum, not a target.
2. **Different data, different clocks.** Raw audio and participant identity have different
   lifetimes (explicitly required by the brief and by good practice).
3. **Aggregate before delete where the aggregate is useful and non-identifying** (attendance counts,
   feedback ratings).
4. **Deletion is deletion** (rows removed, objects removed), evidenced by a deletion record.
5. **No silent extension.** Changing a retention period is an operator decision, recorded in the
   deployment configuration and reflected here.
6. **Records that must survive** (audit, published content) are stated explicitly, not implied.
7. **Retention never deletes something another retained record depends on** — dependencies are
   checked (e.g. a published transcript's audio asset).

## 2. Schedule

| # | Data | Object | Default | Clock starts | Disposition at end | Rationale |
|---|---|---|---|---|---|---|
| R1 | Registration (name, contact, count, accessibility request, consent flags) | rows | **18 months** | event end | hard delete | Needed for the event, follow-up and short-term disputes; not a contact list |
| R2 | Registration aggregates (counts by event/program) | stats | indefinite | — | keep | Non-identifying operational history |
| R3 | Attendance records (with method, entrance, operator) | rows | **24 months** | event end | delete; counts preserved in `event_daily_stats` | Longer than registration because it is the mosque's operational record; anonymised afterwards |
| R4 | Attendance corrections + reasons | rows | as audit (R16) | creation | keep as audit | Integrity of the record |
| R5 | Check-in tokens (hashes) | rows | **30 days** | event end | hard delete | A credential has no value after the event; limits replay forever |
| R6 | Short-code hashes | rows | 30 days | event end | hard delete | same as R5 |
| R7 | Waitlist offers | rows | 90 days | event end | delete | Operational only |
| R8 | Raw audio master (`AudioAsset RAW`) | objects + rows | **24 months** (configurable **6–60**) | asset creation | delete object; keep asset metadata row (duration, checksum) unless the owner requests deletion | The archive's core value; operator decides the cost/history trade-off; the default matches "keep two years of teaching" |
| R9 | Normalized playback asset | objects | same as R8 | creation | delete with R8 | Derived from the master |
| R10 | Transcription derivative audio (16 kHz) | objects | **30 days** | successful transcription | delete | Only needed to (re)run ASR; large |
| R11 | Provider raw payload artefacts | objects | **30 days** | job completion | delete | Diagnostics only; contains content |
| R12 | Published transcripts + revisions | rows | **7 years** | publication | review with the owner (not auto-delete) | Quotable religious content; may be cited; deleting it silently would be worse than keeping it |
| R13 | Transcript drafts never published | rows | **12 months** | event end | delete | No archival value; contains machine errors |
| R14 | Transcript flags (unresolved) | rows | with the transcript | — | keep until resolved or transcript deleted | Review accountability |
| R15 | Feedback raw (ratings + comments) | rows | **12 months** | event end | delete raw; keep per-event aggregates | Honest: after a year, free text about a specific evening has served its purpose |
| R16 | Audit events | rows | **7 years** | creation | keep | Accountability, incident investigation, UU PDP |
| R17 | Telemetry (logs, traces, metrics) | store | **30 days** logs, **90 days** metrics | creation | delete | Operations only; contains no personal data by policy |
| R18 | Notification intents + delivery attempts | rows | **180 days** | dispatch | delete | Delivery proof for a reasonable support window |
| R19 | Notification preferences | rows | until subject deleted | — | delete with subject | — |
| R20 | Exports (CSV) | objects | **7 days** | creation | delete | Contains participant data; must not accumulate |
| R21 | Backups | objects/volumes | **35 days** rolling | backup creation | expire; documented in `docs/operations/BACKUP-RESTORE.md` | Recovery window |
| R22 | Job queue rows (pg-boss) | rows | **30 days** (completed), 180 days (dead-lettered) | completion | delete | Housekeeping; DLQ retention for investigation |
| R23 | Domain events (outbox) | rows | **24 months** | occurrence | delete | Handler replay/diagnosis history |
| R24 | Recording session metadata (chunks, gaps, devices) | rows | **7 years** for completed sessions; **90 days** for failed/abandoned | session end | keep metadata, delete chunk rows after assembly + 7 days | Metadata is small and supports disputes ("the recording failed — why?"); chunks are not |
| R25 | Moderation reports/decisions | rows | **7 years** | decision | keep | Trust & safety |
| R26 | Speaker verification records | rows | permanent | — | keep | Public trust record |
| R27 | Organizer account data | rows | account life + 90 days | deletion request | delete (audit retains actor references as tombstones) | — |
| R28 | Prayer-time cache (if configured) | rows | 12 months | — | delete | Not personal data |

## 3. Interaction rules (what the clocks do not do)

1. **Deleting a registration does not delete the attendance record**, and vice versa: R1 (18 months)
   and R3 (24 months) are deliberately different. Attendance is the mosque's record; the contact
   detail is the participant's.
2. **Deleting a check-in token does not affect attendance** (R5 ends far earlier than R3). This is
   why the check-in token is a separate entity from day one (`DOMAIN.md` §6.5).
3. **Deleting transcription derivative audio does not delete the transcript** (R10 vs R12/R13).
4. **Deleting raw audio is blocked while a published transcript or published page depends on it**
   unless the owner explicitly unpublishes first (dependency check in the retention job).
5. **Anonymising for aggregation happens before deletion**: attendance → counts (R3→R2); feedback →
   aggregates (R15); registrations → counts (R1→R2).
6. **Data-subject deletion overrides retention**: a valid request deletes immediately, with the
   consequence explained; the deletion record notes what was removed and what could not be (e.g. an
   audit entry that must remain, or content the speaker approved).
7. **Retention does not run silently on a production event day**: the job is scheduled in quiet
   hours and skips events in `IN_PROGRESS`.
8. **Deletion of audio is verifyable**: the job checks object existence after deletion and records
   any failure as an alert (`RETENTION_DELETION_FAILED`).

## 4. Deletion evidence record

Each retention run writes one row (and one audit event) containing:

```jsonc
{
  "runId": "uuid",
  "policyKey": "R1.registration",
  "evaluatedAt": "2026-10-01T02:00:00Z",
  "cutoff": "2025-04-01T00:00:00Z",
  "candidates": 1183,
  "deleted": 1183,
  "skipped": [{ "reason": "DATA_SUBJECT_REQUEST_PENDING", "count": 2 }],
  "dependentProtected": [{ "reason": "PUBLISHED_TRANSCRIPT_DEPENDS", "count": 4 }],
  "durationMs": 8412
}
```

No personal data appears in the record (counts and policy keys only). Records are retained 7 years
as part of the audit trail, so "we deleted what we said we would" is demonstrable.

## 5. Guest and legal holds

| Situation | Behaviour |
|---|---|
| Complaint or incident under investigation | A **legal hold** flag on the affected event/organization suspends R1/R3/R8/R15 for those rows; holds are audited and require a reason and an expiry |
| Ongoing data-subject request | Rows associated with the request are excluded from retention until resolved (and then deleted) |
| Active legal/insurance requirement by the mosque | The operator can raise a hold with a documented reason; the product does not silently override it |
| Deployment closure | A documented offboarding procedure (`OPERATIONS.md` §Offboarding): export for the mosque, then deletion of participant data with an evidence record |

## 6. Operator configuration

| Setting | Default | Range | Effect |
|---|---|---|---|
| `RETENTION_REGISTRATION_MONTHS` | 18 | 3–60 | R1 |
| `RETENTION_ATTENDANCE_MONTHS` | 24 | 6–120 | R3 |
| `RETENTION_AUDIO_MONTHS` | 24 | 6–60 | R8/R9 |
| `RETENTION_TRANSCRIPT_DRAFT_MONTHS` | 12 | 3–36 | R13 |
| `RETENTION_FEEDBACK_MONTHS` | 12 | 3–36 | R15 |
| `RETENTION_AUDIT_YEARS` | 7 | 3–10 | R16 |
| `RETENTION_TELEMETRY_DAYS` | 30 | 7–90 | R17 |

Changing a setting must be reflected in the deployment's own privacy notice; the software cannot do
that for the operator, and `OPERATIONS.md` says so explicitly.

## 7. Job behaviour (specification; not implemented in Phase 0)

- **Idempotent** and **resumable**: each policy processes in batches with a cursor; a crash resumes
  without double-deleting (deletion of a non-existent row is a no-op counted as `alreadyGone`).
- **Dry-run mode** (mandatory before enabling in production): produces the same evidence record with
  `deleted: 0` and full candidate counts.
- **Rate-limited** to avoid load spikes (batch size + sleep between batches).
- **Observable**: metrics `retention_deleted_total{policyKey}`, `retention_duration_ms{policyKey}`,
  `retention_failures_total{policyKey}`, and an alert if a policy has not run in 48 hours.
- **Ordered**: child rows before parents (e.g. segments before transcripts; chunks before sessions)
  to respect FKs; object deletion before row deletion so a failed object delete is retryable.
- **Skips events in progress** and honours holds.

## 8. Verification

| Check | Frequency | Evidence |
|---|---|---|
| Dry-run counts reviewed by the operator | monthly | dry-run record |
| Deletion actually removed rows/objects | per run | post-delete verification counts in the evidence record |
| Dependent protection worked (published transcript + audio) | per run | `dependentProtected` counts |
| No policy stale (> 48 h since last run) | alert | `RETENTION_RUN_STALE` |
| Configuration matches the published privacy notice | yearly review | operator checklist in `OPERATIONS.md` |
| Audit history intact after runs | per run | audit row counts monotonic |
