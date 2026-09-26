# DOMAIN EVENTS

Domain events are **immutable, past-tense facts** written by the module that owns the state
change, in the same database transaction, into the `domain_events` outbox (see ADR-0015 for the
notification variant and `DATA_MODEL.md` §domain_events for the table).

## 1. Why not Kafka (or any broker)

The brief lists 19+ events. The instinct is then to reach for a message broker. We do not, and
the reasoning matters because it is a standing design question
(`docs/architecture/FINAL-REVIEW.md` §"Do we actually need a queue?"):

1. **Events here are facts, not streams.** Nobody consumes them independently at scale; they
   trigger in-process handlers (notifications, search indexing, stats, alerts).
2. **Transactional consistency is the requirement.** "Registration created but no confirmation
   notification" is a bug. Storing the event in the *same* transaction as the state change makes
   that impossible; a broker makes it a two-phase problem.
3. **Operational cost.** A broker is another stateful system to run, monitor and upgrade for a
   volunteer operator, and it adds a failure mode (broker down ⇒ what happens to the write?).
4. **Reversibility.** If the team ever needs real streaming (e.g. live captions, or a separate
   analytics service), the outbox pattern is exactly the migration path: add a dispatcher that
   publishes to the broker. The event catalogue and payloads do not change.

Events are also **not** the primary integration mechanism between modules: synchronous service
calls handle request-scoped work (capacity checks, attendance writes). Events handle *effects*
that must not block the request (notify, index, aggregate, alert).

## 2. Naming, envelope and rules

Naming: `<Aggregate><PastTenseVerb>`. The aggregate is the thing that changed, not the thing that
caused it.

Envelope (every event):

```jsonc
{
  "id": "uuidv7",
  "eventType": "ParticipantCheckedIn",       // registry key, stable forever
  "eventVersion": 1,                          // per-type payload version
  "occurredAt": "2026-10-11T06:14:12.331Z",   // UTC
  "actor": { "kind": "USER|SYSTEM|PUBLIC", "id": "uuid?", "capabilityRef": "hash?" },
  "organizationId": "uuid",
  "aggregate": { "type": "AttendanceRecord", "id": "uuid" },
  "correlationId": "request-id",
  "causationId": "uuid?" | null,              // the event that caused this one, if any
  "dedupeKey": "ParticipantCheckedIn:{attendanceId}",
  "payload": { /* per-type, schema-validated */ }
}
```

Rules:

1. **Payloads contain ids, counts and enums — never personal data, never secrets, never content.**
   No names, no contact details, no transcript text, no tokens. A consumer that needs details
   reads them through its own authorised query.
2. **Payloads are versioned and additive.** Removing or retyping a field requires a new
   `eventVersion`; consumers must ignore unknown fields.
3. **`dedupeKey` is required for idempotent consumers** and unique where used.
4. **Emission is inside the transaction.** If the transaction rolls back, no event exists.
5. **Handlers must be idempotent** — the outbox may retry a dispatch after a partial failure.
6. **Events are not deleted by handlers**; retention handles them (`RETENTION.md`).
7. **No event is emitted for a failed attempt** unless the failure itself is a domain fact
   (e.g. `TranscriptionFailed`).

## 3. Event catalogue

Fields are illustrative of the payload; the authoritative shape is
`src/shared/contracts/events.ts`.

### 3.1 Organization & mosque

| Event | Emitted by | Payload | Handlers | Requirement |
|---|---|---|---|---|
| `OrganizationCreated` | organizations | `{ organizationId, kind, timezone }` | audit, defaults bootstrap | FR-ORG-001 |
| `MemberInvited` | organizations | `{ organizationId, invitationId, roles[] }` | notification (invitee) | FR-ORG-002 |
| `MemberRolesChanged` | organizations | `{ organizationId, memberId, addedRoles[], removedRoles[] }` | audit, notification | FR-ORG-002/005 |
| `MosqueCreated` | mosques | `{ organizationId, mosqueId, kind, timezone, hasCoordinates }` | audit, search index, public cache warm | FR-MOSQUE-001 |
| `MosqueUpdated` | mosques | `{ mosqueId, changedFields[] }` (field **names** only) | search index, audit | FR-MOSQUE-002/003 |
| `MosqueDeactivated` | mosques | `{ mosqueId, reason }` | event publication guard, notification to organizers | FR-MOSQUE-009 |
| `VenueCreated` / `VenueUpdated` | mosques | `{ mosqueId, venueId, capacity? }` | audit, capacity recomputation | FR-MOSQUE-005/006 |
| `EntranceCreated` | mosques | `{ mosqueId, venueId, entranceId }` | check-in context resolution | FR-MOSQUE-007 |

### 3.2 Speaker

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `SpeakerCreated` | `{ speakerId, type, organizationId }` | audit, search index | FR-SPEAKER-001 |
| `SpeakerProfileClaimed` | `{ speakerId, userId }` | verification queue, notification | FR-SPEAKER-005 |
| `SpeakerVerificationChanged` | `{ speakerId, status, verifiedBy }` | audit, public cache invalidation, notification | FR-SPEAKER-002 |
| `SpeakerUnlisted` | `{ speakerId, reason }` | public projection update, content visibility rules | FR-SPEAKER-006 |

### 3.3 Program

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `KajianProgramCreated` | `{ programId, mosqueId, recurrenceSummary }` | audit, public program list | FR-PROGRAM-001 |
| `KajianProgramScheduleChanged` | `{ programId, changedFields[] }` | audit, notice to organizers (does **not** mutate existing events) | FR-PROGRAM-002/004 |
| `KajianProgramPaused` / `KajianProgramEnded` | `{ programId }` | public projection update | FR-PROGRAM-005 |
| `KajianEventsGenerated` | `{ programId, eventIds[] }` | audit, organizer notification (draft events ready) | FR-PROGRAM-004 |

### 3.4 Event

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `KajianScheduled` | `{ eventId, mosqueId, venueId?, speakerId, startsAt, timeMode }` | audit, notifications (organizers), calendar links | FR-EVENT-001 |
| `KajianPublished` | `{ eventId, slug, registrationMode }` | search index, public cache, subscriber notices (opt-in program followers = organizers only in MVP) | FR-EVENT-010 |
| `RegistrationOpened` | `{ eventId, opensAt, capacity? }` | audit, reminders scheduling | FR-EVENT-005 |
| `RegistrationClosed` | `{ eventId, reason: 'MANUAL'\|'CAPACITY'\|'TIME' }` | audit, waitlist decisions | FR-EVENT-005, FR-REG-012 |
| `KajianRescheduled` | `{ eventId, previousStartsAt, newStartsAt, reason }` | notification (all active registrants), audit, reminder reschedule | FR-EVENT-004 |
| `KajianCancelled` | `{ eventId, reason, cancelledBy }` | notification (all active registrants), registration cancellation cascade, audit, alert resolution | FR-EVENT-011 |
| `KajianStarted` | `{ eventId }` | dashboard, alerts (`EVENT_STARTING_SOON` cleared) | FR-ANALYTICS-002 |
| `KajianCompleted` | `{ eventId, endedAt, attendanceClosedAt }` | attendance finalisation job (NO_SHOW derivation), feedback scheduling, content workflow offer | FR-EVENT-012 |
| `KajianArchived` | `{ eventId }` | search index, public list exclusion | FR-EVENT-013 |
| `KajianRecordingPolicyChanged` | `{ eventId, previousPolicy, newPolicy }` | audit, alert if a recording is in progress | FR-EVENT-007 |

### 3.5 Registration

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `ParticipantRegistered` | `{ eventId, registrationId, status, participantCount }` | confirmation notification, stats, outbox to organizers (count only) | FR-REG-001 |
| `ParticipantWaitlisted` | `{ eventId, registrationId, position }` | notification with explanation | FR-REG-004 |
| `RegistrationCancelled` | `{ eventId, registrationId, reason?, byParticipant }` | waitlist offer decision, stats, notification | FR-REG-006 |
| `WaitlistOfferIssued` | `{ eventId, registrationId, offerId, expiresAt }` | notification with deadline | FR-REG-014 |
| `WaitlistOfferAccepted` | `{ eventId, registrationId }` | capacity recomputation, confirmation notification | FR-REG-014 |
| `WaitlistOfferExpired` | `{ eventId, registrationId, offerId }` | next-candidate offer | FR-REG-014 |
| `CapacityReached` | `{ eventId, capacity }` | alert `CAPACITY_NEAR_LIMIT`/`CAPACITY_REACHED`, organizer notification, public state update | FR-ANALYTICS-002 |
| `InvitationIssued` | `{ eventId, invitationId, channel, expiresAt }` | delivery notification (**never** containing the token in plain text over an uncontrolled channel) | FR-REG-007 |
| `CheckInTokenReissued` | `{ registrationId, reason }` | audit, notification to the participant's own capability link | FR-CHECKIN-013 |

### 3.6 Check-in & attendance

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `ParticipantCheckedIn` | `{ eventId, attendanceId, method, entranceId?, isWalkIn: false }` | stats, dashboard, search? (no), alert checks | FR-CHECKIN-004 |
| `DuplicateCheckInDetected` | `{ eventId, registrationId, firstCheckedInAt, deviceLabel }` | metric, alert if rate abnormal (possible token sharing) | FR-CHECKIN-004, SECURITY QR replay |
| `WalkInRegistered` | `{ eventId, attendanceId, registrationId? }` | stats, dashboard | FR-CHECKIN-008 |
| `CheckInRejected` | `{ eventId, reason: 'WRONG_EVENT'\|'EXPIRED'\|'CANCELLED'\|'REVOKED'\|'WINDOW_CLOSED' }` | metric (aggregate), no PII | FR-CHECKIN-005/006/007 |
| `AttendanceRecorded` | `{ eventId, attendanceId, method }` | audit, stats | FR-ATTEND-001 |
| `AttendanceSummaryFinalized` | `{ eventId, registered, checkedIn, walkIn, cancelled, noShow }` | organizer notification, content workflow, alert resolution | FR-ATTEND-002/003 |
| `AttendanceCorrected` | `{ attendanceId, action, correctedBy, hasReason: true }` | audit, stats recomputation | FR-ATTEND-004 |

### 3.7 Recording & audio

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `RecordingStarted` | `{ eventId, sessionId, operatorId, policySnapshot, captureConfig }` | dashboard card, health monitor registration | FR-AUDIO-001/013 |
| `RecordingPaused` / `RecordingResumed` | `{ sessionId, atMs }` | dashboard, gap accounting | FR-AUDIO-001 |
| `RecordingHealthDegraded` | `{ sessionId, reason: 'SILENCE'\|'DEVICE_LOST'\|'UPLOAD_BACKLOG'\|'ENCODER_STALL', detail }` | immediate operator alert (`AUDIO_RECORDING_INTERRUPTED`) | FR-AUDIO-004/006, OBS-008 |
| `RecordingStopped` | `{ sessionId, durationMs, chunkCount, gapCount }` | assembly scheduling | FR-AUDIO-001 |
| `AudioUploadCompleted` | `{ sessionId, chunks, bytes, gaps[] }` | assembly job enqueue, dashboard | FR-AUDIO-009 |
| `AudioUploadFailed` | `{ sessionId, missingSequences[], attempts }` | alert `AUDIO_UPLOAD_FAILED`, operator notification | FR-AUDIO-006 |
| `RecordingRecovered` | `{ sessionId, recoveredChunks, missingChunks[] }` | operator notice, metric | FR-AUDIO-008 |
| `RecordingDiscarded` | `{ sessionId, reason, discardedBy }` | retention (delete raw assets), audit | FR-AUDIO-016 |
| `AudioAssetCreated` | `{ assetId, eventId, kind, durationMs, sizeBytes }` | transcription availability, content workflow | FR-AUDIO-009/010 |
| `AudioProcessingCompleted` | `{ sessionId, assets: [{assetId, kind}] }` | notification to organizers (ready to publish), dashboard card | FR-AUDIO-010 |
| `AudioProcessingFailed` | `{ sessionId, errorCode, attempts }` | alert, operator notification, retry policy | FAILURE-MODEL F7 |
| `AudioPublished` | `{ eventId, assetId, chapterCount? }` | search index, participant notification (`FR-NOTIF-004`), public cache | FR-CONTENT-001 |

### 3.8 Transcription & content

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `TranscriptionRequested` | `{ eventId, jobId, assetId, providerId, languageHints[] }` | provider submission job, dashboard status | FR-TRANSCRIPT-001 |
| `TranscriptionStarted` | `{ jobId, providerId }` | dashboard | FR-TRANSCRIPT-002 |
| `TranscriptionCompleted` | `{ jobId, transcriptId, segmentCount, providerId }` | draft creation, reviewer assignment queue, notification to reviewers | FR-TRANSCRIPT-002/005 |
| `TranscriptionFailed` | `{ jobId, providerId, errorCode, retriable }` | alert `TRANSCRIPTION_FAILED`, notification, retry policy | FAILURE-MODEL F10 |
| `TranscriptDrafted` | `{ transcriptId, source: 'MACHINE', segmentCount }` | review queue, search index **excluded** | FR-TRANSCRIPT-010 |
| `TranscriptRevisionSaved` | `{ transcriptId, revisionNumber, authorId, source }` | audit, review progress | FR-TRANSCRIPT-009 |
| `TranscriptFlagged` | `{ transcriptId, flagKind, segmentId? }` | speaker/organizer notification where configured | FR-TRANSCRIPT-016 |
| `TranscriptApproved` | `{ transcriptId, revisionId, approvedBy }` | publication readiness, **never** auto-publish | FR-TRANSCRIPT-006 |
| `TranscriptPublished` | `{ transcriptId, eventId, revisionId, url }` | search index, participant notification, public cache, content integrity stamp | FR-TRANSCRIPT-011 |
| `TranscriptUnpublished` | `{ transcriptId, reason, by }` | search de-index, cache purge, notification to owner, audit | FR-TRANSCRIPT-012 |
| `ContentChapterAdded` | `{ eventId, chapterId, startMs }` | public cache, search | FR-CONTENT-002 |
| `ContentMaterialAdded` | `{ eventId, materialId, kind }` | public cache | FR-CONTENT-003 |
| `ContentReported` | `{ reportId, targetType, targetId, reasonKey }` | moderation queue, moderator notification | FR-MOD-001 |
| `ModerationDecisionRecorded` | `{ decisionId, reportId?, action, hasReason: true }` | enforcement job (unpublish/suspend), notification to owner, audit | FR-MOD-002/004 |

### 3.9 Feedback, notifications, ops

| Event | Payload | Handlers | Requirement |
|---|---|---|---|
| `FeedbackSubmitted` | `{ eventId, feedbackId, isAnonymous, ratingsPresent: string[] }` — **never the text** | aggregate recomputation, organizer dashboard, abuse screening (rate) | FR-FEEDBACK-001 |
| `FeedbackRequestScheduled` | `{ eventId, sendAt, audience: 'ATTENDEES' }` | notification scheduling | FR-FEEDBACK-007 |
| `NotificationQueued` | `{ intentId, templateKey, channel }` | dispatch job | FR-NOTIF-006 |
| `NotificationDispatched` | `{ intentId, channel, providerMessageId? }` | delivery stats | FR-NOTIF-006 |
| `NotificationFailed` | `{ intentId, channel, attempts, errorCode }` | retry/backoff, alert `NOTIFICATION_FAILURE_RATE_HIGH` | NFR-OBS-003 |
| `OperationalAlertRaised` | `{ alertKey, severity, subjectType, subjectId, dedupeKey }` | organizer/operator notification, dashboard | FR-ANALYTICS-002 |
| `OperationalAlertResolved` | `{ alertKey, subjectType, subjectId, resolvedBy? }` | dashboard cleanup, dedupe reset | FR-ANALYTICS-002 |
| `RetentionRunCompleted` | `{ runId, policies: [{policyKey, deletedCount}] }` | audit, operator report | RETENTION.md |
| `DataSubjectRequestCompleted` | `{ requestId, kind: 'ACCESS'\|'DELETION'\|'EXPORT', affectedTables[] }` | audit, notification to requester | NFR-PRIV-002 |

## 4. Consumption map (who listens to what)

| Consumer | Events consumed | Effect | Idempotency key used |
|---|---|---|---|
| Notifications dispatcher | `ParticipantRegistered`, `ParticipantWaitlisted`, `RegistrationCancelled`, `WaitlistOfferIssued`, `KajianCancelled`, `KajianRescheduled`, `AudioPublished`, `TranscriptPublished`, `FeedbackRequestScheduled`, `RecordingHealthDegraded`, `AudioUploadFailed`, `TranscriptionFailed`, `AttendanceSummaryFinalized` | Create/dispatch `notification_intents` | `dedupeKey` of the source event + template key |
| Attendance finaliser | `KajianCompleted` | Close the check-in window, derive `NO_SHOW` counts, emit `AttendanceSummaryFinalized` | `AttendanceSummaryFinalized:{eventId}` |
| Media pipeline | `AudioUploadCompleted` | Enqueue assembly/processing (single job per session) | singleton job key `assemble:{sessionId}` |
| Transcription dispatcher | `TranscriptionRequested` | Submit to provider (single in-flight job per asset) | `submit:{jobId}` |
| Search indexer | `KajianPublished`, `KajianArchived`, `AudioPublished`, `TranscriptPublished`, `TranscriptUnpublished`, `ContentChapterAdded`, `MosqueUpdated`, `SpeakerCreated` | Upsert/remove `content_search_documents` | `{eventType}:{aggregateId}` |
| Stats/analytics | registration, check-in, feedback, attendance events | Update `event_daily_stats` (recomputable) | `{statKey}:{eventId}:{day}` |
| Alert evaluator | health/upload/transcription/check-in events + metrics | Raise/deduplicate `operational_alerts` | `alertKey:{subjectId}` |
| Audit writer | every event marked `auditable` in the registry | Append `audit_events` | `{eventType}:{aggregateId}:{occurredAt}` |

**Rule:** a consumer that cannot be made idempotent must not be added. Consumers read their own
data; they never mutate another module's tables (`ARCHITECTURE.md` §5).

## 5. Events deliberately *not* introduced

| Candidate | Why not |
|---|---|
| `QrScanned` (raw scan) | Not a domain fact about the system; it is telemetry. Emitting it would create enormous volume with no consumer and would tempt putting payload content in events. |
| `PageViewed`, `NotificationOpened` | Engagement telemetry, deliberately not modelled (anti-metrics, `PRD.md` §18). |
| `UserLoggedIn` | Auth-layer concern; audit handles the security-relevant subset (role changes, not logins). |
| `ChunkUploaded` (per chunk) | Volume without value; the session-level `AudioUploadCompleted`/`AudioRecordingDegraded` cover the domain need. Chunk metadata lives in `recording_chunks`. |
| `SpeakerRated` | Forbidden (ADR-0024). |
| `TranscriptAutoApproved` | Cannot exist (ADR-0012). |

## 6. Adding an event (checklist for a future implementer)

1. Is it a **fact about the world** (something happened) rather than a command or a query? If not,
   it does not belong here.
2. Does at least one consumer need it *without* blocking the request that produced it? If not, a
   service call is the right tool and no event is needed.
3. Add it to the registry (`src/shared/contracts/events.ts`) with `eventVersion: 1`, a
   `dedupeKey` template, and a payload **containing no personal data or content**.
4. Add a row to this document (emitter, payload, handlers, requirement ID).
5. Write the consumer idempotency test and add the event to `docs/TRACEABILITY.md`.
6. If the event implies external delivery (broker), write an ADR first — do not silently add a
   transport.
