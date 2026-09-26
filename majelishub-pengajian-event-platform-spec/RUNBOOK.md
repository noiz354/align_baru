# RUNBOOK

Procedure-per-problem. Every alert in `OBSERVABILITY.md` §10 maps to a section here. Read the
**Symptoms → Immediate action → Diagnose → Resolve → Verify** sequence in order; do not skip
"Immediate action" to start diagnosing.

Golden rules: protect the room first; production data is never edited by hand; every action taken is
written down; when in doubt, fail closed.

---

## RB-01 · Check-in failures spike at the entrance (`CHECKIN_FAILURE_RATE_HIGH`)

**Symptoms:** volunteers report scans not confirming; check-in failure ratio > 5%; long line.
**Immediate action (within 2 minutes):**
1. Tell the volunteers aloud: "Switch to manual entry now." (The moment people hesitate, the line
   doubles.)
2. Have one person open the check-in console on a **second device** and try a known test code to see
   whether the failure is device-specific or global.
3. If global, enable a printed-list manual check-in for the busiest entrance and record entries on
   paper for later bulk entry.

**Diagnose:** database reachable and pool not saturated; app 5xx rate; specific result codes
(`UNAVAILABLE` vs `INVALID_TOKEN` vs `WRONG_EVENT`); network at the venue; system clock on the
scanner device (a wrong clock can invalidate window checks — check the context bar).
**Resolve:** restart the app container if the pool is exhausted; if the database is the problem,
follow RB-09; if the venue network is the problem, keep everyone on manual entry and record arrival
times on paper.
**Verify:** the test code confirms; scan rate returns; the paper entries are entered during the event
or immediately after (never later than the same day), each with a reason; the attendance summary is
reconciled against the paper sheet.

---

## RB-02 · Scanner device not scanning (`CHECKIN_SCANNER_STALLED`)

**Symptoms:** no scans for 10 minutes on a bound device during an open window.
**Immediate action:** contact the volunteer; ask them to (1) confirm the app is in the foreground,
(2) check the context bar says the right event, (3) switch to manual/short-code entry and continue.
**Diagnose:** camera permission revoked; browser tab backgrounded or throttled; battery saver;
device overheated; wrong event selected; window closed; screen rotation locked with the scanner UI.
**Resolve:** re-grant permission, reload the page, re-bind the device to the entrance, or switch to
manual mode. Never instruct a volunteer to "just start over" if the token already showed — partial
successes must be verified, not duplicated.
**Verify:** the volunteer completes 3 successful scans (including one duplicate-scan check against a
participant already checked in).

---

## RB-03 · Duplicate scans are high (`DUPLICATE_SCAN_RATE_HIGH`)

**Symptoms:** duplicate-scan metric elevated; organizer asks why the same person appears twice.
**Immediate action:** confirm duplicates are **rejected** (they should be — this is expected
behaviour, not corruption) and inform the door staff that duplicates are being logged, not counted.
**Diagnose:** someone forwarded a QR screenshot to a friend; one participant's code in a photo the
volunteer re-scans by accident; a stuck finger/multiple taps; two entrances sharing one code.
**Resolve:** explain the "one code, one attendance" rule to the participant; if a genuine overlap is
suspected (someone checked in without being present in the room), mark it in the operator notes and
raise it with the organizer — do **not** silently correct attendance.
**Verify:** no duplicate attendance rows exist (query the event's attendance count vs registration
counts).

---

## RB-04 · Recording has gaps / interrupted (`AUDIO_RECORDING_INTERRUPTED`)

**Symptoms:** the recorder page shows a gap warning; a chunk failed permanently; the operator phone
lost the microphone.
**Immediate action:** notify the operator in the room and the organizers at the front; if the physical
recorder/phone's audio is still functioning, restart the session **on the same event** and continue
(it is better to have continuous audio than to stop).
**Diagnose:** which gap window; was it an OS-level audio interruption, a tab suspension, a device
change, or a storage failure? Read the session's chunk list and the gap report.
**Resolve:** if the gap is small (≤ 30 s), keep the session; if large, the summary will state the gap
honestly. Use a backup device (a second phone) if the primary keeps failing.
**Verify:** the final summary lists the gap with timestamps; the asset is playable across the
boundary; if more than ~2 minutes are missing in a single block, the organizer is told immediately so
a re-record or a note about the transcript can be planned. **The recording is never described as
complete when it is not.**

---

## RB-05 · Chunk uploads backing up (`AUDIO_UPLOAD_FAILED`, backlog > 20 chunks)

**Symptoms:** the recorder shows a growing backlog; uploads failing/retrying.
**Immediate action:** tell the operator the situation and what to do (keep the page open, keep the
phone awake on Wi-Fi, do not close the tab); if the event is over and the device is going home,
**do not clear the browser data** — the queue is stored locally and must be flushed before the device
is cleaned up.
**Diagnose:** venue connectivity; storage availability (RB-08); size limits (is a chunk exceeding the
limit?); expiry/timeout configuration; clock skew (signature failures on presigned URLs).
**Resolve:** restore connectivity; if the venue network is unusable, move the device to a better
network while keeping the page open; if storage credentials were rotated, fix and retry (chunks are
idempotent, retries are safe).
**Verify:** backlog reaches zero; total accepted chunks equal the expected count; assembly runs.

---

## RB-06 · Audio processing failed (`AUDIO_PROCESSING_FAILED`)

**Immediate action:** do nothing destructive. The master chunks are safe; processing can be retried.
**Diagnose:** job error text; media worker health; ffmpeg exit code (input container malformed?
truncated chunk? disk full? CPU limit hit?); whether the same session failed repeatedly.
**Resolve:** retry the job once after checking health; if the input is genuinely malformed, the session
is marked partial and the organizer is informed with an honest statement of what is playable.
**Verify:** the asset state becomes `READY` with a duration matching the session, playback works
across the full timeline, and the derived files exist with the expected loudness targets.

---

## RB-07 · Storage unavailable (`STORAGE_UNAVAILABLE`)

**Immediate action:** uploads/reads fail closed (no partial writes, no fake success). Tell operators
to keep recording locally and not to close pages.
**Diagnose:** provider status, credentials, endpoint reachability, bucket existence/policy.
**Resolve:** restore provider access or credentials; retry. If a hosted provider is down for hours,
note the affected sessions; local queues will drain when it returns.
**Verify:** a test upload and download succeed; the backlog clears; no objects were created with zero
size (a zero-byte object is a corruption signal — investigate rather than overwrite).

---

## RB-08 · Database unavailable or saturated (`DB_POOL_SATURATED`)

**Immediate action:** switch entrances to the manual path; stop non-essential jobs (`retention`,
backfills) to reduce load.
**Diagnose:** connection count, long-running queries, locks, disk space, replication/backup load.
**Resolve:** restart the app (pool reset) if the pool is leaked; terminate runaway queries only with a
recorded justification; if disk is full, follow the storage-growth procedure — never delete rows
ad hoc.
**Verify:** app health green, check-in latency back to budget, job queues resuming, no lost writes
(compare a known registration count before/after).

---

## RB-09 · Transcription failed or stuck (`TRANSCRIPTION_FAILED`, `TRANSCRIPTION_QUEUE_AGING`)

**Immediate action:** nothing for the audio — it is unaffected. Tell the organizer the review timeline
may shift.
**Diagnose:** provider reachability/quota/credentials; job state; audio duration vs configured limit;
ingress/egress flag (a deployment with egress disabled will always fail a hosted provider — this is
intended behaviour, not a bug).
**Resolve:** retry; switch provider only through configuration with a documented decision; if a
provider repeatedly emits malformed output, mark that audio for manual transcription and record it.
**Verify:** a draft transcript exists with segments, timestamps and the provider/version recorded;
the reviewer is notified.

---

## RB-10 · Transcript awaiting review too long (`TRANSCRIPT_REVIEW_REQUIRED`)

**Immediate action:** contact the organizer — the cause is almost always human capacity, not the
system.
**Diagnose:** assign a different reviewer; check whether the reviewer is blocked by something
(timestamps not matching, audio quality, unclear segments).
**Resolve:** reassign; if nobody is available, the correct outcome is to **wait** and communicate, not
to publish unreviewed. Never approve on someone else's behalf.
**Verify:** the transcript has an approver recorded with a name and timestamp; the published revision
matches the approved revision.

---

## RB-11 · Notification failures (`NOTIFICATION_FAILURE_RATE_HIGH`)

**Immediate action:** for essential reminders during an event, post the reminder in whatever channel
the mosque already uses (its own WhatsApp group/news board) and note that the system message failed.
**Diagnose:** provider status, API key, sender reputation, invalid contact formats, dead letters,
quiet-hours misconfiguration.
**Resolve:** fix credentials/format; re-dispatch dead letters only after verifying they are still
relevant (a "tomorrow's kajian" reminder sent three days late is worse than not sent).
**Verify:** test dispatch succeeds on each channel; dead-letter count returns to zero; no duplicate
messages were sent for the same intent (dedupe key proof).

---

## RB-12 · Retention run failed or stale (`RETENTION_RUN_STALE`, `RETENTION_DELETION_FAILED`)

**Immediate action:** keep it in dry-run for the affected policy if the failure is a verification
mismatch.
**Diagnose:** the last run report: rows expected vs deleted, objects expected vs deleted; storage
permissions; foreign-key blocks (a dependency protection is a *correct* refusal); job duration vs
timeout.
**Resolve:** fix permissions/timeouts; run again in dry-run, compare counts, then enable. Report to the
owner when data older than the configured window remains due to a blocked dependency.
**Verify:** post-run verification passes (counts match), the evidence record is stored, and no records
younger than the policy were affected.

---

## RB-13 · Admin lockout / lost credentials

**Immediate action:** use the documented break-glass procedure (a sealed credential held by two named
people, or database-level recovery performed on the server with a witness). Do not create a new admin
account silently.
**Diagnose:** locked account, expired session, 2FA device lost, secret rotated without update.
**Resolve:** restore access, then **rotate** anything that was exposed and audit what the break-glass
account did.
**Verify:** the legitimate administrator can log in; the emergency path is re-sealed; audit entries
exist for every action taken with the recovery credential.

---

## RB-14 · Security incident (see `docs/security/INCIDENT-RESPONSE.md`)

**Immediate action:** contain first — revoke the involved credentials, disable the suspect account or
token class, close the affected flag if the exposure is ongoing. **Do not** start a public
explanation before containment and a facts collection.
**Then:** follow the incident document: severity, evidence preservation (never wipe logs), scope
determination (whose data, how many records), notification decision (72-hour obligation under UU PDP
if personal data is involved), and communication drafting with legal review.
**Verify:** the exposure vector is closed and independently verified; affected individuals are
informed per the decision; the threat model and tests are updated so the class of incident cannot
recur silently.

---

## RB-15 · Published content must be withdrawn urgently

**Immediate action:** unpublish (organizer/speaker/platform admin) with a reason; confirm the search
index no longer returns it; confirm audio/transcript signing is refused.
**Diagnose:** why (misattribution, speaker request, incorrect citation, privacy).
**Resolve:** keep the audit record of what was published and when; inform the requester of what has
been removed; if a correction is possible, the corrected version goes through review again (no
silent edits to published revisions).
**Verify:** direct link shows an explanation page; the event page no longer advertises the media;
the requester confirms; the incident log entry exists.

---

## RB-16 · Deployment/rollback during a live event (emergency)

1. Confirm what is broken and whether it can wait 60 minutes. Most things can.
2. Prefer the **flag** (check-in manual-only, recording disabled, notifications paused) over a deploy.
3. If a deploy is unavoidable: take a backup first, deploy only the fix, watch closely, and write down
   the timeline as the event runs.
4. Never run a migration during an event.
5. Post-event: complete the full release checklist and record the deviation.

---

## RB-17 · Operator notices early warning signs

| Sign | Meaning | First check |
|---|---|---|
| Several sessions with "0 chunks accepted" | venue network down or credentials broken | RB-05 |
| A mosque suddenly sees far fewer registrations for the same program | event not visible, notification failed, or date/time wrong | public discovery + notification history |
| Check-in rate far below registration rate at a normally full venue | scanning didn't happen or the wrong event was open | attendance method breakdown + console context |
| Feedback volume drops to zero | link missing on the event page or notification failed | event page + templates |
| Audio quality "clipped" complaints | PA overdrive at the source | `docs/media/AUDIO-QUALITY.md` guidance |

---

## RB-18 · Backup/restore drill (`docs/operations/BACKUP-RESTORE.md`)

**Immediate action (drill):** announce the drill; use the scratch environment only.
**Steps:** identify the newest backup → restore into scratch → verify a checksum list of key tables →
restore 3 sampled storage objects → start the app against the restored data → run a read-only smoke
check (public event page, one attendance report) → record duration and gaps.
**Verify:** restore time documented and acceptable; row counts and object hashes match; the drill is
signed by two people. A backup that has never been restored is not a backup.
