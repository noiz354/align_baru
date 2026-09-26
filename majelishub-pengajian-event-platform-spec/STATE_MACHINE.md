# STATE MACHINES

Transitions only — **no implementation**. Each machine lists states, allowed transitions, guards,
side effects and explicitly forbidden transitions. Transition tables exist as data in
`src/domain/<entity>/*.transitions.ts`; this document is their specification.

Conventions:

- **Guard** = a condition that must hold for the transition to be allowed.
- **Side effect** = a domain event and/or job emitted in the same transaction.
- Transitions not listed are **invalid** and must be rejected (not silently ignored).
- Every terminal state is marked ⌛; every state reachable only by a human action marks the
  required permission.

---

## 1. KajianEvent

States: `DRAFT` · `SCHEDULED` · `REGISTRATION_OPEN` · `REGISTRATION_CLOSED` · `IN_PROGRESS` ·
`COMPLETED` · `CANCELLED` · `ARCHIVED`

```
DRAFT ──publish──▶ SCHEDULED ──openRegistration──▶ REGISTRATION_OPEN
                       │                                  │
                       │◀────────closeRegistration─────────┤ (manual)
                       │                                  │
                       │                       (capacity reached) ├─▶ REGISTRATION_CLOSED
                       │                                  │
                       └────────start──────▶ IN_PROGRESS ◀┘
                                              │
                                    complete  │  (auto at endsAt, or manual)
                                              ▼
                                          COMPLETED ──archive──▶ ARCHIVED ⌛

  any of {DRAFT, SCHEDULED, REGISTRATION_OPEN, REGISTRATION_CLOSED, IN_PROGRESS}
                                              │
                                          cancel ▼
                                         CANCELLED ⌛ (reason required)
```

| # | From | To | Guard | Side effects |
|---|---|---|---|---|
| E1 | — | `DRAFT` | actor has `event.create`; mosque/venue in scope | `KajianScheduled`(draft variant recorded), audit |
| E2 | `DRAFT` | `SCHEDULED` | **Publish checklist** `I-EVENT-3`: title, mosque, speaker, time resolved-or-estimated, registration/attendance/recording/transcription policies explicit | `KajianPublished`, audit, search index |
| E3 | `SCHEDULED` | `REGISTRATION_OPEN` | `registrationMode ≠ NO_REGISTRATION`; window reached or opened manually; `startsAt` in the future | `RegistrationOpened` |
| E4 | `REGISTRATION_OPEN` | `REGISTRATION_CLOSED` | manual close by `event.write`, or capacity reached (auto), or start window reached | `RegistrationClosed{reason}` |
| E5 | `REGISTRATION_CLOSED` | `REGISTRATION_OPEN` | actor has `event.write`; manual reopen; capacity still available | `RegistrationOpened`, audit (reopen is unusual and recorded) |
| E6 | `SCHEDULED`/`REGISTRATION_OPEN`/`REGISTRATION_CLOSED` | `IN_PROGRESS` | manual "start" or `startsAt` reached with `autoStart` configured | `KajianStarted` |
| E7 | `IN_PROGRESS` | `COMPLETED` | `endsAt` passed, or manual complete by `event.write` | `KajianCompleted`, attendance finalisation job |
| E8 | `REGISTRATION_OPEN`/`REGISTRATION_CLOSED`/`SCHEDULED`/`IN_PROGRESS` | `COMPLETED` | manual early completion (e.g. kajian finished early) with reason | same as E7 + audit with reason |
| E9 | any of {DRAFT…IN_PROGRESS} | `CANCELLED` | actor `event.cancel`; **reason required** | `KajianCancelled`, cascade: active registrations cancelled, pending tokens invalidated, reminders cancelled, audit |
| E10 | `COMPLETED` | `ARCHIVED` | actor `event.write`; no incomplete media pipeline jobs | `KajianArchived`, search index update |
| E11 | `CANCELLED` | ⌛ | — | (no un-cancel; a new event is created instead — history integrity) |
| E12 | `ARCHIVED` | ⌛ | — | (unarchive is explicitly not supported in MVP) |
| E13 | `SCHEDULED`/`REGISTRATION_OPEN`/`REGISTRATION_CLOSED` | same state | **reschedule** (time change, not a state change) | `KajianRescheduled`, notification to registrants, reminder reschedule, `event_schedule_changes` row, audit |
| E14 | any non-terminal | same state | **speaker change** | `KajianEventSpeakerChanged`(audit-only event), notify registrants (P1), audit |
| E15 | any non-terminal | same state | **policy change** (recording/transcription) | audit + `KajianRecordingPolicyChanged`; if a recording is in progress, raise an alert and require explicit acknowledgement |

**Forbidden transitions (must be rejected with a specific error):**

| Attempt | Why forbidden |
|---|---|
| `DRAFT` → `REGISTRATION_OPEN` | Cannot open registration for an unpublished event (there is no public page) |
| `CANCELLED` → `REGISTRATION_OPEN` / `IN_PROGRESS` | Cancellation is terminal; reopening would resurrect invalidated tokens and confuse attendees |
| `COMPLETED` → `REGISTRATION_OPEN` | Attendance facts exist; accepting new registrations retroactively corrupts the record |
| `ARCHIVED` → any | Archive is a public-content state; unarchiving is a new decision, not a transition |
| `IN_PROGRESS` → `DRAFT` | No un-publishing history |
| Publish without policies | `I-EVENT-3` — a missing recording policy is exactly the consent problem we must not have |

---

## 2. Registration

States: `REGISTERED` · `WAITLISTED` · `CANCELLED` ⌛ · attendance is **not** a registration state
(it lives in `attendance_records`; `CHECKED_IN` in the brief's list is represented by
`attendance.attended = true`, which is why no transition back to `REGISTERED` exists).

```
 (create) ─▶ REGISTERED ──cancel──▶ CANCELLED ⌛
                │  ▲
        (promote)│  │(offer declined/expired → stays WAITLISTED or is cancelled)
                ▼  │
            WAITLISTED ──cancel──▶ CANCELLED ⌛
```

| # | From | To | Guard | Side effects |
|---|---|---|---|---|
| R1 | — | `REGISTERED` | event `REGISTRATION_OPEN`; mode permits; capacity available (`I-REG-2`); no active duplicate for the same contact (`I-REG-3`); invitation valid for `INVITATION` mode | `ParticipantRegistered`; token issued; confirmation intent |
| R2 | — | `WAITLISTED` | capacity full **and** waitlist enabled | `ParticipantWaitlisted{position}`; token issued (so a promoted participant needs no new artefact) |
| R3 | `WAITLISTED` | `REGISTERED` | an offer was issued and accepted before expiry, or an organizer promotes manually; capacity now available | `WaitlistOfferAccepted`; confirmation intent; **same** registration id and token |
| R4 | `REGISTERED`/`WAITLISTED` | `CANCELLED` | actor is the participant (capability) or an organizer with `registration.manage`; **no attendance record exists** | `RegistrationCancelled`; seat release → offer to next waitlisted; token revoked; notification |
| R5 | `REGISTERED` | `REGISTERED` | idempotent replay of the same submission | none (returns the original result) |
| R6 | `WAITLISTED` | `WAITLISTED` | offer expired without acceptance | `WaitlistOfferExpired`; next candidate offered |
| R7 | `REGISTERED` | `REGISTERED` | contact change by organizer (typo fix) with reason | audit; notification to the new contact |

**Forbidden:**

| Attempt | Why |
|---|---|
| `CANCELLED` → `REGISTERED` | No resurrection: a participant registers anew (a new row), preserving the cancellation history |
| cancel a registration that has an attendance record | The attendance fact is durable; use `attendance_corrections` with a reason (ADR-0025) |
| `WAITLISTED` → checked in | Not registered; the correct path is a walk-in record or manual correction with reason |
| `REGISTERED` → `WAITLISTED` (demotion) | Only an explicit organizer action with reason may demote (P2, and it is a *new* state change: `REGISTERED → CANCELLED` + re-add to waitlist, audited) |

---

## 3. Check-in attempt (the outcome vocabulary is a state machine too)

Each check-in attempt resolves to exactly one **result** using the same vocabulary as
`API-011`. This is a terminal set, not a persisted entity state — the persisted effects are the
attendance record and the audit event.

```
                 ┌── VALID ─────────────▶ attendance created
payload  ─parse──┼── ALREADY_CHECKED_IN ▶ existing attendance (non-blocking)
                 ├── INVALID_TOKEN ─┬─▶ INVALID_FORMAT   (rejected locally, no server call)
                 │                  ├─▶ INVALID_TOKEN    (unknown hash)
                 │                  └─▶ REVOKED          (re-issued elsewhere)
                 ├── WRONG_EVENT
                 ├── EXPIRED
                 ├── CANCELLED
                 ├── WINDOW_CLOSED
                 └── UNAVAILABLE ───────▶ "belum tercatat" (client must not show success)
```

| Result | Meaning | Persisted effect | Operator next action |
|---|---|---|---|
| `VALID` | Attendance committed **by this call** | `attendance_records` insert + `ParticipantCheckedIn` + audit | none |
| `ALREADY_CHECKED_IN` | Already attended; first scan time returned | `DuplicateCheckInDetected` (metric + audit) | continue |
| `INVALID_FORMAT` | Payload is not a MajelisHub token | none (client-side) | retry / manual |
| `INVALID_TOKEN` | Well-formed but unknown | audit (rate-limited) | manual lookup |
| `WRONG_EVENT` | Valid token, another event | audit | check the event binding; manual lookup for the correct event |
| `EXPIRED` | Token/past window | audit | manual lookup (valid registration) |
| `CANCELLED` | Registration cancelled or event cancelled | audit | walk-in registration if appropriate |
| `WINDOW_CLOSED` | Check-in window not open | audit | ask an organizer to open the window |
| `UNAVAILABLE` | Dependency failure | none (never a success) | retry; use paper/manual per `CHECKIN.md` |

**Invariant:** exactly one of these results is returned, and only `VALID`/`ALREADY_CHECKED_IN`
are ever rendered as a positive outcome.

---

## 4. RecordingSession

States: `PREPARING` · `RECORDING` · `PAUSED` · `STOPPING` · `UPLOADING` · `COMPLETED` ⌛ ·
`FAILED` ⌛ · `RECOVERABLE` · `ABANDONED` ⌛

```
 (create) ─▶ PREPARING ──start──▶ RECORDING ⇄ PAUSED
                                    │            │
                            stop ◀──┘            │
                              ▼                  │
                          STOPPING ◀─────────────┘
                              │
                              ▼
                          UPLOADING ──all chunks acked──▶ COMPLETED ⌛
                              │                              ▲
                              │                        (assembly+processing ok)
                              ├── chunk gap unrecoverable ──▶ RECOVERABLE ──▶ UPLOADING
                              └── fatal (no audio / forced) ▶ FAILED ⌛
 (create) ─▶ PREPARING ──operator discards──▶ ABANDONED ⌛
```

| # | From | To | Guard | Side effects |
|---|---|---|---|---|
| A1 | — | `PREPARING` | event policy ≠ `NONE`; operator has `recording.operate`; device available | `RecordingStarted`(prep), policy snapshot stored |
| A2 | `PREPARING` | `RECORDING` | microphone stream acquired; first chunk scheduled | `RecordingStarted`, health monitor registered |
| A3 | `RECORDING` | `PAUSED` | operator pause | `RecordingPaused` |
| A4 | `PAUSED` | `RECORDING` | operator resume; new recorder instance in the **same** session | `RecordingResumed` |
| A5 | `RECORDING`/`PAUSED` | `STOPPING` | operator stop | final chunk requested; `RecordingStopped` |
| A6 | `STOPPING` | `UPLOADING` | final chunk written to the queue | chunk uploads continue |
| A7 | `UPLOADING` | `COMPLETED` | all sequences acknowledged; **or** gaps explicitly allowed with a reason | `AudioUploadCompleted`, assembly job enqueued |
| A8 | `UPLOADING` | `RECOVERABLE` | an acknowledged chunk is missing per server state; or the session was resumed after a crash with gaps | `RecordingRecovered` (or health alert) |
| A9 | `RECOVERABLE` | `UPLOADING` | the client supplied the missing sequences | `AudioUploadCompleted` once complete |
| A10 | any of {`RECORDING`,`PAUSED`,`UPLOADING`,`RECOVERABLE`} | `FAILED` | fatal: no audio captured at all, or operator/organizer forces failure | `AudioUploadFailed`/`RecordingHealthDegraded`, alert, retention applies |
| A11 | `PREPARING` | `ABANDONED` | operator discards before any chunk | `RecordingDiscarded` |
| A12 | `COMPLETED` | ⌛ | — | reprocessing is a **new asset**, never a session rewind |

**Forbidden:**

| Attempt | Why |
|---|---|
| `COMPLETED` → `RECORDING` | A completed session is an immutable record; a second attempt is a new session (`FR-AUDIO-015`) |
| `FAILED` → `UPLOADING` | Recovery is only permitted from `RECOVERABLE`; a fatal failure is terminal (a new session starts instead) |
| `PAUSED` → `STOPPING` without a final chunk | Rejected: stopping must flush; otherwise the tail is lost silently |
| upload chunks into a `COMPLETED`/`FAILED`/`ABANDONED` session | `409`/`422` — prevents late writes corrupting an assembled asset |
| `RECORDING` without a policy snapshot | Consent/integrity requirement: no recording without the policy recorded (`FR-AUDIO-013`) |

---

## 5. AudioAsset / processing

States: `PENDING` · `UPLOADED` · `ASSEMBLING` · `ASSEMBLED` · `PROCESSING` · `READY` ·
`SUPERSEDED` · `DELETED` ⌛ · `FAILED`

```
 (chunks complete) ─▶ UPLOADED ──assemble──▶ ASSEMBLING ──▶ ASSEMBLED (RAW, current)
                                                   │
                                                   └──fail──▶ FAILED (retriable, job attempts)
 ASSEMBLED ──process──▶ PROCESSING ──▶ READY (NORMALIZED, current)
                                  └──fail──▶ FAILED
 READY ──new processing run──▶ SUPERSEDED (previous asset kept; is_current=false)
 any (non-current, not referenced by published content) ──retention──▶ DELETED ⌛
```

| Rule | Detail |
|---|---|
| One current asset per `(session, kind, profile)` | partial unique index (`DATA_MODEL.md`) |
| `RAW` master immutability | `I-AUD-5`: never overwritten, never deleted by producing a derivative |
| Failed processing | retriable job with attempts; after exhaustion → alert + `AudioProcessingFailed`; the master remains playable/recoverable |
| Deleting an asset that a published transcript references | forbidden (checked at deletion time) |

---

## 6. TranscriptionJob

States: `NOT_REQUESTED` · `QUEUED` · `PROCESSING` · `DRAFT` · `REVIEW_REQUIRED` · `APPROVED` ·
`PUBLISHED` · `FAILED` ⌛

```
NOT_REQUESTED ──request──▶ QUEUED ──submit──▶ PROCESSING ──result──▶ DRAFT
                                                            │
                                                     (gate) ▼
                                                 REVIEW_REQUIRED ──approve──▶ APPROVED
                                                        ▲                       │
                                                        └──edits (new revision)──┤
                                                                                ▼
                                                                           PUBLISHED ⇄ UNPUBLISHED
 PROCESSING ──provider error/timeout──▶ FAILED (retriable while attempts remain)
```

| # | From | To | Guard | Side effects |
|---|---|---|---|---|
| T1 | `NOT_REQUESTED` | `QUEUED` | event `transcriptionPolicy ≠ NONE`; asset `READY`; no in-flight job | `TranscriptionRequested` |
| T2 | `QUEUED` | `PROCESSING` | provider accepted the submission | `TranscriptionStarted` |
| T3 | `PROCESSING` | `DRAFT` | provider returned a well-formed result **and** segmentation succeeded | `TranscriptionCompleted`, `TranscriptDrafted` (`source=MACHINE`) |
| T3b | `PROCESSING` | `FAILED` | provider error, timeout beyond policy, or **malformed/empty result** | `TranscriptionFailed{retriable}` |
| T4 | `DRAFT` | `REVIEW_REQUIRED` | segmentation produced ≥ 1 segment; reviewer assignment exists (or the queue is open) | review queue entry, reviewer notification |
| T5 | `REVIEW_REQUIRED` | `REVIEW_REQUIRED` | reviewer saves edits | **new `TranscriptRevision`**; `TranscriptRevisionSaved` |
| T6 | `REVIEW_REQUIRED` | `APPROVED` | actor has `transcript.approve`; unresolved blocking flags are resolved or explicitly acknowledged | `TranscriptApproved` (pins `approved_revision_id`) |
| T7 | `APPROVED` | `PUBLISHED` | event policy allows publication **and** `published_revision_id = approved_revision_id` **and** `approved_by IS NOT NULL` | `TranscriptPublished`, search index, notification |
| T8 | `APPROVED`/`REVIEW_REQUIRED` | `REVIEW_REQUIRED` | a post-approval edit creates a new revision | approval is invalidated for the new revision (`approved_revision_id` cleared for that content) |
| T9 | `PUBLISHED` | `UNPUBLISHED` | actor `moderator.decide` or content owner with reason | `TranscriptUnpublished`, de-index, cache purge, audit |
| T10 | `UNPUBLISHED` | `PUBLISHED` | re-approval by a reviewer; reason recorded | `TranscriptPublished`, audit |
| T11 | `FAILED` | `QUEUED` | retry explicitly requested by an organizer (attempts < max) | new job row (the failed job is retained for history) |

**Forbidden (the integrity core — ADR-0012):**

| Attempt | Why |
|---|---|
| `PROCESSING`/`DRAFT` → `APPROVED` without human action | Machine output has no authority |
| `DRAFT`/`REVIEW_REQUIRED` → `PUBLISHED` | Skips the gate; also blocked by a database check constraint |
| `PUBLISHED` without `approved_revision_id` | Same constraint |
| `PUBLISHED` when policy ≠ `PUBLISH_AUDIO_AND_TRANSCRIPT` | Policy enforcement (`FR-CONTENT-007`) |
| auto-"correction" of text during any transition | ADR-0012: automation may flag, never rewrite |
| re-running a provider on a `PUBLISHED` transcript in place | A new machine pass creates a **new draft revision**, never mutates published content |

---

## 7. Publication (content-level, spans audio + transcript + materials)

States: `INTERNAL` · `READY_TO_PUBLISH` · `PUBLISHED` · `UNPUBLISHED` · `TAKEN_DOWN` ⌛

```
INTERNAL ──(policy allows + assets ready + transcript approved if required)──▶ READY_TO_PUBLISH
                               │
                          publish ▼
                          PUBLISHED ⇄ UNPUBLISHED ──┐
                               │                    │
                        moderator takedown ◀────────┘
                               ▼
                           TAKEN_DOWN ⌛
```

| Rule | Detail |
|---|---|
| `PUBLISHED` requires | asset visibility = `PUBLIC`; if the transcript is published, an approved revision; chapters/materials validated |
| `UNPUBLISHED` | reason required; content is de-indexed; direct links show an explanation, not a 404 |
| `TAKEN_DOWN` | moderation-only; requires a decision record; content is removed from all public surfaces immediately, audio access revoked at the signing step |
| Publishing is never automatic | a human action (`event.write` or `content.publish`) is always required, even after processing completes |

---

## 8. Notification intent

States: `PENDING` · `DISPATCHED` · `FAILED` · `DEAD_LETTERED` ⌛ · `CANCELLED` ⌛

| From | To | Guard | Notes |
|---|---|---|---|
| — | `PENDING` | intent created in a transaction | dedupe key unique |
| `PENDING` | `DISPATCHED` | channel adapter accepted | attempt recorded |
| `PENDING` | `FAILED` | adapter error | `next_attempt_at` with backoff |
| `FAILED` | `PENDING` | retry allowed (attempts < max) | — |
| `FAILED` | `DEAD_LETTERED` | attempts exhausted | alert `NOTIFICATION_FAILURE_RATE_HIGH`, visible in `/operasional` |
| `PENDING`/`FAILED` | `CANCELLED` | source event superseded (e.g. event cancelled before a reminder) | no delivery |

**Forbidden:** `DISPATCHED` → any (a sent notification is a fact); sending twice for the same
`dedupe_key`.

---

## 9. Speaker profile

States (listing, orthogonal to verification): `LISTED` · `UNLISTED` · `SUSPENDED`

| From | To | Guard | Side effects |
|---|---|---|---|
| — | `LISTED` | creator is an organizer | `SpeakerCreated` |
| `LISTED` ⇄ `UNLISTED` | speaker request or organizer action | public projection update; past events keep showing the name (historical record) but without a profile link |
| `LISTED`/`UNLISTED` | `SUSPENDED` | moderator decision with reason | profile hidden, content flagged for review, audit, appeal path |
| `SUSPENDED` | `LISTED` | successful appeal with decision record | audit |

Verification: `PENDING` → `VERIFIED` | `REJECTED`; `VERIFIED` → `REVOKED` (with reason). Verification
is **not** a rank and never gates publication of content (ADR-0024).

---

## 10. Attendance window (event-level machine that drives `NO_SHOW`)

States: `NOT_OPEN` · `OPEN` · `CLOSED` · `FINALIZED`

| From | To | Guard | Side effects |
|---|---|---|---|
| `NOT_OPEN` | `OPEN` | event `IN_PROGRESS` or explicit early open by an organizer (queue outside the door is a real thing) | check-in becomes permitted |
| `OPEN` | `CLOSED` | event completed, or organizer closes (default: `endsAt + 60 min`) | `NO_SHOW` derivation window closes; late arrivals require the correction path |
| `CLOSED` | `FINALIZED` | summary computed and stored | `AttendanceSummaryFinalized`; notification; alert resolution |

**Rule:** `NO_SHOW` is a **report fact** computed at `CLOSED`, never a state transition applied to
participants. Reopening a window is permitted (`CLOSED → OPEN` with reason, audited) and simply
recomputes the report.

---

## 11. Cross-cutting: why transitions are data, not if-statements

Each machine's transitions are declared as an immutable table
(`{ from, to, guardId, sideEffectIds }`) in `src/domain/<entity>/*.transitions.ts`, so that:

- a test can assert every declared transition is reachable and every undeclared one is rejected
  (exhaustive state-pair test — cheap and complete),
- documentation (`STATE_MACHINE.md`) and code cannot drift silently, because the test compares the
  table to this document's list,
- a reviewer can see the full behaviour of a machine in one screen instead of tracing branches.

**Phase 0 status:** the transition tables exist as typed data with guards referenced **by id**
only; guard implementations and side effects are `NotImplemented` (see `src/domain/**/*.ts`).
