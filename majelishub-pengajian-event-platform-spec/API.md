# API CONTRACTS

Wire-level contracts for every planned operation. **No handlers exist in Phase 0.** The types
live in `src/shared/contracts/**`; this document defines semantics, and the two must agree.

- Transport: HTTPS, JSON (`application/json; charset=utf-8`) except chunk upload
  (`multipart/form-data` or raw binary) and CSV export (`text/csv`).
- Surfaces: **Server Actions** for organizer/participant form mutations (same contracts, no
  REST envelope), and **route handlers** under `/api/**` for machine-ish operations (check-in
  validation, chunk upload, webhooks, exports). Both use the same service layer and the same
  validation schemas.
- Versioning: `/api/v1/**`. Breaking changes require a new version and a deprecation window.
- Idempotency: header `Idempotency-Key` (client-generated UUIDv7) on **all** mutations that
  create or advance state. Scope = (operation, actor-or-capability, target aggregate). Replays
  return the original response with `Idempotent-Replay: true`.

## 1. Conventions

### Actors and authentication

| Actor | Authentication | Notes |
|---|---|---|
| Participant (public) | none | `POST /registration` on `OPEN` events only |
| Participant (capability) | signed, short-lived link token in the path (`/pendaftaran/[token]`, `/undaftar`) | The capability authorises only that registration's own read/cancel/feedback operations |
| Operator | session cookie (Better Auth) | Role + scope resolved server-side per request |
| Check-in device | session cookie + device binding | Device is bound to one event/venue per shift (`FR-CHECKIN-002`) |
| Worker/internal | not HTTP | Jobs run in-process; no public internal API |
| Provider webhook (STT) | HMAC signature header over the raw body + timestamp window | Verified before parsing |

### Authorization

Every operation below declares the required **permission** (see
`docs/security/AUTHZ-MATRIX.md`), which resolves to roles + scope (organization, optional mosque
subset). The client never supplies its own scope: `organizationId` is derived from the actor or
from the addressed aggregate, and cross-org access returns **404** (not 403) for object fetches
to avoid existence leakage (ADR-0017).

### Validation

- All inputs validated with shared schemas (`src/shared/validation/**`) **server-side**, always,
  even when the client also validates.
- Unknown fields are rejected (`.strict()`), preventing accidental mass-assignment.
- String bounds are explicit; free text is normalised (trim, NFC) and length-bounded.
- Enum values are validated against the state-machine value sets.

### Errors

Single taxonomy in `src/shared/contracts/errors.ts`:

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_FAILED` | 422 | Field-level errors in `details` |
| `UNAUTHENTICATED` | 401 | No/expired session |
| `FORBIDDEN` | 403 | Authenticated but not permitted (only where existence is already known) |
| `NOT_FOUND` | 404 | Including cross-tenant objects |
| `CONFLICT` | 409 | Optimistic-lock conflict, duplicate where duplicates are errors, state conflict |
| `ALREADY_CHECKED_IN` | 200 (in body) | **Not an error** — a distinct success-shaped result (ADR-0025) |
| `PRECONDITION_FAILED` | 412 | e.g. capacity full without waitlist, policy forbids action |
| `RATE_LIMITED` | 429 | With `Retry-After` |
| `DEPENDENCY_UNAVAILABLE` | 503 | Storage/DB/provider; safe to retry (idempotency key preserved) |
| `INTERNAL` | 500 | No details leaked; `requestId` returned for support |

Responses never include the token value, provider payloads, or internal ids of other tenants.

### Rate limits (defaults; configurable per deployment)

| Operation | Limit | Scope |
|---|---|---|
| `POST /registration` | 5/min, 30/day | per contact hash + per IP |
| `POST /checkin/validate` | 600/min | per device session |
| `POST /checkin/walk-in` | 60/min | per operator |
| `POST /recordings/{id}/chunks` | 120/min | per session |
| `POST /transcription/request` | 10/hour | per organization |
| `POST /feedback` | 3/day | per capability hash |
| `POST /auth/*` | provider-configured durable limiter | per identifier + IP |
| `GET /api/v1/exports/*` | 10/day | per user |

Limits are enforced with a durable store (not in-memory) — `SECURITY.md` §Rate limiting.

### Idempotency and concurrency

- Mutations accept `Idempotency-Key`; the server stores `(key, actor, operation)` → response hash
  for 24 h (check-in: 7 days) and replays the stored response.
- Aggregates that can be edited concurrently carry `version`; updates send `If-Match: <version>`
  and receive `409 CONFLICT` with the current server state on mismatch (transcripts, events).
- Check-in additionally accepts a client-generated `eventCheckinId` so device retries and
  (future) offline batches deduplicate (ADR-0007).

### Pagination, filtering, sorting

- Cursor pagination: `?limit=20&cursor=<opaque>`; responses include `nextCursor`.
- Public lists are sorted by time (default), distance (when location provided), or relevance to
  an **explicit filter**. No engagement-based sorting exists (ADR-0024).
- Filters are explicit and documented per endpoint; unknown filters are rejected.

### Audit and telemetry

Every operation lists its **audit requirement**. Audit events are written in the same transaction
as the change. Telemetry follows the allow-list in `OBSERVABILITY.md`; **no operation may log
request bodies containing personal data or tokens.**

---

## 2. Participant operations

### API-001 · Discover events
- **Requirement IDs:** FR-EVENT-014, FR-CONTENT-004
- **Actor / Auth:** public · **Permission:** `event.read.public`
- **Input:** `GET /api/v1/events?from=&to=&mosqueId=&topic=&language=&programId=&near=&cursor=&limit=`
- **Output:** `{ items: PublicEventSummary[], nextCursor }` — summary: slug, title, speaker
  display name, mosque name + area, venue label, resolved time (with `isEstimate`), registration
  state (`OPEN|FULL|CLOSED|INVITATION|WALK_IN|NO_REGISTRATION`), topics, language.
- **Validation:** date range ≤ 90 days; `limit ≤ 50`.
- **Errors:** `VALIDATION_FAILED`, `RATE_LIMITED`.
- **Idempotency:** N/A (safe method).
- **Privacy:** no attendee counts that reveal individuals; no participant data; unlisted speakers
  show as "Pembicara" without a profile link.
- **Audit:** none (aggregate analytics only).

### API-002 · Event detail
- **Requirement IDs:** FR-EVENT-015/016, FR-MOSQUE-003/007, FR-PROGRAM-003
- **Actor / Auth:** public · **Permission:** `event.read.public`
- **Input:** `GET /api/v1/events/{slug}`
- **Output:** full detail incl. venue + entrance notes, facilities, `recordingPolicy` display
  string, `registrationMode`, capacity state (`remaining` only when the number is trustworthy),
  program link, reschedule history (public part), chapters if published.
- **Errors:** `NOT_FOUND` (draft, cancelled-without-public-notice, internal).
- **Privacy:** `INTERNAL` recording policy ⇒ the response omits audio/transcript sections and an
  `internal: true` flag explains it (FR-CONTENT-007).

### API-003 · Register for an event
- **Requirement IDs:** FR-REG-001…005, 010, 011, 014, NFR-SEC-010
- **Actor / Auth:** public · **Permission:** `registration.create.public` (subject to event mode)
- **Input:** `POST /api/v1/events/{eventId}/registrations`
  ```jsonc
  {
    "name": "Sariah",                     // 2..80, no HTML
    "contact": { "type": "WHATSAPP", "value": "+6281…" },
    "participantCount": 1,                // 1..20
    "accessibilityRequest": "butuh kursi",// optional, ≤ 500
    "idempotencyKey": "uuidv7",
    "consent": { "contactUse": true, "recordingNoticeAcknowledged": true }
  }
  ```
- **Output:** `{ registrationId, status: REGISTERED|WAITLISTED, waitlistPosition?, checkInCode: { shortCode, qrPngDataUrl }, accessToken, event }` — the **only** response that ever contains the token, delivered to the participant who just registered.
- **Validation:** event is `REGISTRATION_OPEN`; mode permits; capacity checked in-transaction;
  contact format by type; no extra fields.
- **Errors:** `VALIDATION_FAILED`, `PRECONDITION_FAILED` (closed/full without waitlist),
  `CONFLICT` (duplicate active registration for the same contact → returns the existing
  registration via capability link, not an error page), `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE`.
- **Idempotency:** required; key + `(eventId, contactHash)` both enforce uniqueness.
- **Concurrency:** capacity is enforced with a conditional insert under a transaction
  (`CONCURRENCY` C1); the loser is waitlisted or rejected **with an explicit explanation**.
- **Privacy:** minimal fields only; contact stored normalised + hashed; **no PII in the token**.
- **Audit:** `registration.created` (actor: system+contact hash, not name).

### API-004 · View my registration (capability)
- **Requirement IDs:** FR-REG-009, NFR-MOB-004
- **Actor / Auth:** capability link · **Permission:** `registration.read.own`
- **Input:** `GET /api/v1/registrations/{accessToken}` (also used by the offline-cached page)
- **Output:** event summary, my status, venue entrance notes, `checkInCode`, `checkedInAt?`,
  `cancellable`, `lastSyncedAt`.
- **Errors:** `NOT_FOUND` (expired/unknown capability), `FORBIDDEN` (revoked token after re-issue).
- **Idempotency:** safe.
- **Privacy:** response contains no other participant's data; no organizer contact details unless
  published.
- **Audit:** none for reads (rate-limited); token rotations are audited.

### API-005 · Cancel my registration
- **Requirement IDs:** FR-REG-006, FR-REG-014
- **Actor / Auth:** capability link · **Permission:** `registration.cancel.own`
- **Input:** `POST /api/v1/registrations/{accessToken}/cancel` `{ reason?, idempotencyKey }`
- **Output:** `{ status: CANCELLED, seatReleasedTo?: "WAITLIST_OFFER" }`
- **Errors:** `PRECONDITION_FAILED` (already checked in → cancel refused with the manual-correction
  path explained; event already ended), `CONFLICT` (already cancelled ⇒ idempotent success),
  `NOT_FOUND`.
- **Concurrency:** seat release + waitlist offer are one transaction (`CONCURRENCY` C3).
- **Audit:** `registration.cancelled` with reason.

### API-006 · Submit feedback
- **Requirement IDs:** FR-FEEDBACK-001…003, 007, ADR-0016
- **Actor / Auth:** capability link (registered/checked-in) · **Permission:** `feedback.create.own`
- **Input:**
  ```jsonc
  { "eventId": "...", "isAnonymous": true,
    "ratings": { "registration": 4, "venue": 3, "audio": 2, "topicRelevance": 5, "organization": 4, "overall": 4 },
    "comment": "…", "shareWithSpeaker": false, "idempotencyKey": "uuidv7" }
  ```
- **Output:** `{ submitted: true, anonymous: true }`
- **Validation:** window open (event completed, ≤ 14 days); one submission per capability unless
  anonymous; ratings 1..5 or omitted; comment ≤ 2000; **no dimension about the speaker as a
  person** (validation rejects unknown rating keys).
- **Privacy:** anonymous submissions store **no** link to registration/contact (DB check).
- **Audit:** `feedback.submitted` (anonymous submissions record no actor — an explicit exception
  documented in `SECURITY.md` §Audit).

---

## 3. Check-in operations

### API-010 · Resolve check-in context
- **Requirement IDs:** FR-CHECKIN-001/002/012/013
- **Actor / Auth:** operator session + bound device · **Permission:** `checkin.operate`
- **Input:** `GET /api/v1/events/{eventId}/checkin/context?entranceId=`
- **Output:** `{ eventId, eventTitle, venue, entrance, window: { opensAt, closesAt }, capacity, counts: { registered, checkedIn, walkIn }, deviceBinding, scannerConfig: { backendsAllowed } }`
- **Errors:** `FORBIDDEN` (not an operator for this event/mosque), `PRECONDITION_FAILED` (window closed).
- **Privacy:** counts only, aggregated; the response never includes a participant list.

### API-011 · Validate a check-in token
- **Requirement IDs:** FR-CHECKIN-004/005/006/007/011/016, NFR-PERF-002/004, NFR-SEC-004
- **Actor / Auth:** operator · **Permission:** `checkin.validate`
- **Input:** `POST /api/v1/checkin/validate`
  ```jsonc
  { "eventId": "...", "entranceId": "...", "deviceLabel": "HP panitia 2",
    "payload": { "kind": "QR", "value": "<opaque token>" },   // or { kind: "SHORT_CODE", value: "4F2K-9QRS" }
    "eventCheckinId": "uuidv7", "idempotencyKey": "uuidv7", "clientScannedAt": "2026-10-11T06:14:12+07:00" }
  ```
- **Output (200 always for business outcomes):**
  ```jsonc
  { "result": "VALID|ALREADY_CHECKED_IN|INVALID_TOKEN|WRONG_EVENT|EXPIRED|CANCELLED|WINDOW_CLOSED|REVOKED",
    "attendanceId?": "...", "participantFirstName?": "Sariah", "participantCount?": 1,
    "checkedInAt?": "...", "counts": { "checkedIn": 278, "capacity": 320 },
    "nextActions": ["MANUAL_NAME_LOOKUP","REGISTER_WALK_IN"] }
  ```
- **Semantics:** `VALID` **commits** the attendance record in this call (single round trip,
  `NFR-PERF-003`). `ALREADY_CHECKED_IN` is a success-shaped, non-blocking state. Every other
  result is a failure state with explicit next actions.
- **Validation:** token format checked locally and server-side; `organization_id` derived, never
  supplied; device must be bound to this event.
- **Errors:** `DEPENDENCY_UNAVAILABLE` (DB down) — the client must show "belum tercatat", never
  success; `RATE_LIMITED`.
- **Idempotency:** `idempotencyKey` + `eventCheckinId`; replays return the same result.
- **Concurrency:** unique constraint converges concurrent scanners (ADR-0025, `CONCURRENCY` C2).
- **Privacy:** the response exposes the participant's **first name only** (for operator
  confirmation) and never contact details.
- **Audit:** `attendance.checked_in` (or `attendance.duplicate_scan`) with operator, entrance,
  device label, method.

### API-012 · Register a walk-in
- **Requirement IDs:** FR-CHECKIN-008, FR-ATTEND-002, I-ATT-2/4
- **Actor / Auth:** operator · **Permission:** `checkin.walk_in`
- **Input:** `POST /api/v1/checkin/walk-in`
  `{ eventId, entranceId, name, contact?, participantCount, walkInRef (client uuidv7), idempotencyKey }`
- **Output:** `{ attendanceId, registrationId?, shortCode?, counts }`
- **Validation:** event attendance mode permits; name required; duplicate `walkInRef` or matching
  normalised contact for the event ⇒ returns the existing attendance (`ALREADY_CHECKED_IN`
  semantics) instead of a duplicate.
- **Errors:** `PRECONDITION_FAILED` (event registration-required and not walk-in friendly),
  `VALIDATION_FAILED`, `RATE_LIMITED`.
- **Audit:** `attendance.walk_in_created`.

### API-013 · Manual attendance (name lookup)
- **Requirement IDs:** FR-CHECKIN-003, NFR-A11Y-003, FR-ATTEND-004
- **Actor / Auth:** operator · **Permission:** `checkin.manual`
- **Input:** `GET /api/v1/events/{eventId}/registrations/search?q=` (name prefix, ≤ 10 results,
  name + status + masked contact) · then `POST /api/v1/checkin/manual { registrationId, method: NAME_LOOKUP, reason?, idempotencyKey }`
- **Output:** same shape as API-011.
- **Validation:** search requires ≥ 3 characters; results are scoped to the event only.
- **Privacy:** contact shown masked (`+62••••1234`) and to operators only; no export of this list.
- **Audit:** `attendance.checked_in_manual` with reason where applicable.

### API-014 · Check-in summary
- **Requirement IDs:** FR-CHECKIN-012/015, FR-ATTEND-003
- **Input:** `GET /api/v1/events/{eventId}/checkin/summary`
- **Output:** `{ window, counts: { registered, checkedIn, walkIn, cancelled, notYetArrived }, throughput: { perMinuteLast10, perEntrance[] } }`
- **Privacy:** counts only; `perEntrance` carries no operator names.

---

## 4. Attendance & reporting operations

### API-020 · Attendance summary
- **Requirement IDs:** FR-ATTEND-003/006, FR-ANALYTICS-001
- **Actor / Auth:** organizer · **Permission:** `attendance.read`
- **Output:** `{ registered, checkedIn, walkIn, cancelled, noShowDerived, window, dataQuality: { complete: boolean, notes: string[] } }` — `noShowDerived` only after the window closed, with the window stated.
- **Audit:** none (read).

### API-021 · Correct attendance
- **Requirement IDs:** FR-ATTEND-004, FR-AUDIT-003
- **Input:** `POST /api/v1/events/{eventId}/attendance/{attendanceId}/corrections`
  `{ action: FIX_TIME|MARK_PRESENT|MARK_ABSENT|FIX_VENUE, newValue, reason (≥ 8 chars), idempotencyKey }`
- **Output:** `{ attendance: AttendanceRecordView, correctionId }`
- **Validation:** reason required; MARK_ABSENT does not delete the record but sets
  `is_corrected` + `presence_state` (documented; the row remains for audit).
- **Audit:** `attendance.corrected` with before/after (no PII beyond the participant reference).

### API-022 · Export attendance
- **Requirement IDs:** FR-ATTEND-005, PRIVACY.md §Export, FR-AUDIT-004
- **Input:** `POST /api/v1/events/{eventId}/exports/attendance` `{ fields: ["name","status","checkedInAt"], includeContact: false, reason: "laporan panitia" }`
- **Output:** job accepted → CSV produced by the worker → short-lived presigned download URL in the UI.
- **Validation:** `includeContact` requires the role `ORGANIZER` **and** a stated reason; field
  list validated against an allow-list; exports are recorded.
- **Privacy:** default excludes contact; export files carry a retention of 7 days and are deleted
  automatically (`RETENTION.md` §Exports).
- **Audit:** `export.created` with fields, reason, actor.

---

## 5. Recording & audio operations

### API-030 · Start a recording session
- **Requirement IDs:** FR-AUDIO-001/013, I-AUD-1
- **Actor / Auth:** audio operator/organizer · **Permission:** `recording.operate`
- **Input:** `POST /api/v1/events/{eventId}/recordings` `{ venueId?, deviceLabel, chunkSeconds: 10, captureConfig: { echoCancellation: false, noiseSuppression: false, autoGain: false }, idempotencyKey }`
- **Output:** `{ sessionId, status: "RECORDING", policySnapshot: { recordingPolicy, transcriptionPolicy }, chunkSeconds, upload: { endpoint, maxChunkBytes } }`
- **Errors:** `PRECONDITION_FAILED` (recordingPolicy = NONE), `FORBIDDEN`, `DEPENDENCY_UNAVAILABLE`.
- **Idempotency:** repeated calls with the same key return the same session; a *new* key creates a
  **new** session (multiple concurrent sessions are legitimate, FR-AUDIO-015).
- **Audit:** `recording.started` with policy snapshot and operator.

### API-031 · Upload a chunk
- **Requirement IDs:** FR-AUDIO-005/006/007, NFR-REL-001, NFR-PERF-005
- **Input:** `POST /api/v1/recordings/{sessionId}/chunks` (multipart)
  fields: `sequence`, `durationMs`, `contentType`, `sha256`, `clientCapturedAt`, `idempotencyKey`; file part `chunk`.
- **Output:** `{ accepted: true, sequence, receivedCount, missingSequences: number[], nextExpectedSequence }`
- **Validation:** session belongs to the actor's organization and is in a writable state;
  `sequence` within `[0, 100000]`; size ≤ 8 MB; declared content type in the allow-list; **magic
  bytes verified** (sniffing); `sha256` matches; existing `(session, sequence)` with the same hash
  ⇒ idempotent success; with a **different** hash ⇒ `409 CONFLICT` (never silently overwrite audio).
- **Errors:** `PRECONDITION_FAILED` (session closed), `VALIDATION_FAILED`, `DEPENDENCY_UNAVAILABLE`
  (storage) — the client retries with backoff and keeps the chunk locally.
- **Privacy:** chunk content is stored privately; never analysed for content; never logged.
- **Audit:** no per-chunk audit rows (volume); session-level start/stop/complete/failure are
  audited, and chunk metadata (count, gaps) is recorded on the session.

### API-032 · Session state & recovery
- **Requirement IDs:** FR-AUDIO-008
- **Input:** `GET /api/v1/recordings/{sessionId}/state`
- **Output:** `{ status, startedAt, stoppedAt?, receivedSequences, missingSequences, lastAckAt, gapMsTotal, policySnapshot, recoverable: boolean }`
- **Purpose:** enables a refreshed or crashed browser to resume and re-send only what is missing;
  the UI reports exactly what was recovered.

### API-033 · Complete a recording session
- **Requirement IDs:** FR-AUDIO-009/016/014
- **Input:** `POST /api/v1/recordings/{sessionId}/complete` `{ allowGaps?: { reason }, operatorNote?, durationMs, idempotencyKey }`
- **Output:** `{ status: "UPLOADING" | "COMPLETED", assemblyQueued: true, gaps: number[] }`
- **Validation:** session must be stopped; `allowGaps` requires a reason (≥ 8 chars) and is
  recorded on the session and the asset.
- **Errors:** `PRECONDITION_FAILED` (no chunks), `CONFLICT` (already completed ⇒ idempotent).
- **Concurrency:** assembly job enqueued **once** (singleton job key per session).
- **Audit:** `recording.completed` with duration, chunk count, gap count.

### API-034 · Audio asset access
- **Requirement IDs:** FR-AUDIO-011/017, FR-CONTENT-007, ADR-0013
- **Input:** `GET /api/v1/audio-assets/{assetId}/url?purpose=PLAY|DOWNLOAD|REVIEW`
- **Output:** `{ url (presigned, ≤ 15 min), expiresAt, rangeSupported: true }`
- **Validation:** authorization by role + event policy + asset visibility; `DOWNLOAD` requires
  `audio.download` permission and is refused for `EXPORT`-kind assets of other tenants (obviously).
- **Privacy:** presigned URLs are credentials: never logged, never sent to third parties; a URL
  request is audited for `DOWNLOAD` and `REVIEW` purposes.

### API-035 · Request audio processing
- **Requirement IDs:** FR-AUDIO-009/010/012, FR-AUDIO-016
- **Input:** `POST /api/v1/recording-sessions/{sessionId}/processing` `{ operations: ["ASSEMBLE","NORMALIZE","TRANSCRIPTION_DERIVATIVE"], profile: "SPEECH", idempotencyKey }`
- **Output:** `{ jobId, status: "QUEUED" }`
- **Errors:** `PRECONDITION_FAILED` (chunks incomplete), `CONFLICT` (already queued).

---

## 6. Transcription operations

### API-040 · Request transcription
- **Requirement IDs:** FR-TRANSCRIPT-001/003/004, I-EVENT-5
- **Actor / Auth:** organizer · **Permission:** `transcription.request`
- **Input:** `POST /api/v1/events/{eventId}/transcription` `{ audioAssetId, languageHints: ["id","ar"], providerId?: "self-hosted-whisper", reviewRequired: true, idempotencyKey }`
- **Output:** `{ jobId, status: "QUEUED", providerId, estimatedDurationS? }`
- **Validation:** event policy permits (≠ `NONE`); asset is assembled and `is_current`; no
  in-flight job for the asset (partial unique); `languageHints` non-empty.
- **Errors:** `PRECONDITION_FAILED` (policy NONE, asset not ready), `CONFLICT` (job in flight),
  `RATE_LIMITED`, `DEPENDENCY_UNAVAILABLE` (provider disabled).
- **Privacy:** voice data leaves the boundary only if a hosted provider is configured; the
  response states the provider id so the action is informed (`PRIVACY.md` §Processors).
- **Audit:** `transcription.requested` with provider, language hints, asset id.

### API-041 · Transcription status
- **Requirement IDs:** FR-TRANSCRIPT-002
- **Input:** `GET /api/v1/transcription-jobs/{jobId}`
- **Output:** `{ status, progressPct?, startedAt?, finishedAt?, providerId, transcriptId?, failureCode?, retriable }`
- **Note:** truthful progress only — no interpolated percentages presented as fact
  (`FR-ATTEND-006` philosophy). If a provider does not report progress, the UI shows a stage
  label instead of a fake bar.

### API-042 · Provider callback (internal)
- **Requirement IDs:** FR-TRANSCRIPT-003, NFR-SEC-006
- **Input:** `POST /api/v1/webhooks/transcription/{providerId}` with HMAC signature + timestamp
- **Validation:** signature over the raw body; timestamp within ±5 min; job id known and in a
  dispatchable state.
- **Concurrency:** **callbacks may repeat** — processing is idempotent per
  `(providerJobId, event)`; a repeated `completed` callback does not create a second draft
  (`CONCURRENCY` C9).
- **Audit:** `transcription.callback_received` (provider, job id, outcome) — **never** transcript
  content.

### API-043 · Open / read a transcript for review
- **Requirement IDs:** FR-TRANSCRIPT-005/007/010/015
- **Actor / Auth:** reviewer, organizer, or the speaker (own talk) · **Permission:** `transcript.review`
- **Input:** `GET /api/v1/transcripts/{transcriptId}` (reviewer view)
- **Output:** `{ transcript: { status, source, provenance, version, approvedRevisionId?, publishedRevisionId? }, segments: [{ id, ordinal, startMs, endMs, text, certainty, kind, speakerLabel?, flags[] }], revisions: [{ revisionNumber, author, createdAt, note }], unresolvedFlags, audio: { assetId, durationMs } }`
- **Privacy:** reviewer view may include unreviewed machine text — the endpoint is never public,
  and responses carry `no-store` cache headers.

### API-044 · Save transcript edits
- **Requirement IDs:** FR-TRANSCRIPT-007/008/009, ADR-0023
- **Input:** `POST /api/v1/transcripts/{transcriptId}/revisions` with `If-Match: <version>`
  `{ baseVersion, operations: [{ segmentId, text?, certainty?, kind?, startMs?, endMs?, speakerLabel? } | { op: "SPLIT"|"MERGE", ... }], note?, idempotencyKey }`
- **Output:** `{ revisionNumber, version, savedAt }`
- **Validation:** text length bounds; timestamps monotone and within duration; certainty/kind
  enums; **no automatic text transformation** is applied server-side (ADR-0012).
- **Errors:** `CONFLICT` (version mismatch → returns a diff of changed segments against the
  client's base), `VALIDATION_FAILED`, `FORBIDDEN`.
- **Concurrency:** optimistic lock; no last-write-wins (`CONCURRENCY` C6).
- **Audit:** `transcript.revision_saved` (revision number, changed segment count — **not** the
  text).

### API-045 · Approve transcript
- **Requirement IDs:** FR-TRANSCRIPT-006/015, I-TRN-2, ADR-0012
- **Input:** `POST /api/v1/transcripts/{transcriptId}/approval` `{ revisionId, reviewerNote?, unresolvedFlagsAcknowledged: boolean, idempotencyKey }`
- **Output:** `{ status: "APPROVED", approvedRevisionId, approvedBy, approvedAt }`
- **Validation:** actor holds `transcript.approve` (not implied by `transcript.review` alone —
  see `AUTHZ-MATRIX`); revision belongs to this transcript; unresolved `CHECK_ARABIC` /
  `CHECK_ATTRIBUTION` flags must either be resolved or explicitly acknowledged.
- **Errors:** `PRECONDITION_FAILED` (unresolved flags), `CONFLICT` (already approved with a
  different revision ⇒ new approval supersedes, recorded), `FORBIDDEN`.
- **Audit:** `transcript.approved` (revision, actor, note).

### API-046 · Publish / unpublish transcript
- **Requirement IDs:** FR-TRANSCRIPT-011/012, FR-CONTENT-006/007, I-TRN-5
- **Input:** `POST /api/v1/transcripts/{transcriptId}/publication` `{ action: "PUBLISH"|"UNPUBLISH", reason?, idempotencyKey }`
- **Output:** `{ status, publishedRevisionId?, publishedUrl? }`
- **Validation:** PUBLISH requires an approved revision **and** an event policy allowing
  publication (`PUBLISH_AUDIO_AND_TRANSCRIPT`); UNPUBLISH requires a reason.
- **Errors:** `PRECONDITION_FAILED` (policy forbids, no approval), `CONFLICT` (already published ⇒
  idempotent), `FORBIDDEN`.
- **Audit:** `transcript.published` / `transcript.unpublished` with reason and revision.

---

## 7. Organizer & admin operations (representative set)

| ID | Operation | Actor / Permission | Key rules |
|---|---|---|---|
| API-050 | Create mosque | `MOSQUE_ADMIN` / `mosque.create` | Valid coordinates/timezone; duplicate-name warning not block |
| API-051 | Create/update venue | `MOSQUE_ADMIN` / `venue.write` | Capacity > 0; entrance notes optional; belongs to mosque |
| API-052 | Create speaker | `ORGANIZER` / `speaker.create` | No popularity fields accepted (schema is strict — extra keys rejected) |
| API-053 | Claim speaker profile | `SPEAKER` / `speaker.claim` | Requires proof path; produces a `PENDING` verification; audited |
| API-054 | Create program | `ORGANIZER` / `program.write` | Recurrence validity; defaults must be in scope |
| API-055 | Generate events from program | `ORGANIZER` / `program.generate` | Range ≤ 6 months; preview → confirm; duplicate `(program, starts_at)` ignored, not overwritten |
| API-056 | Create event | `ORGANIZER` / `event.create` | Validates `I-EVENT-1..3`; drafts may omit speaker/venue |
| API-057 | Update event | `ORGANIZER` / `event.write` | `If-Match` version; rescheduling records `event_schedule_changes` and notifies |
| API-058 | Publish event | `ORGANIZER` / `event.publish` | Checklist `I-EVENT-3`; publishes a slug; audit |
| API-059 | Cancel event | `ORGANIZER` / `event.cancel` | Reason required; cancels registrations; notifications through outbox |
| API-060 | Promoted waitlist | `ORGANIZER` / `registration.manage` | Offer with expiry; acceptance reuses the same registration + token |
| API-061 | Verify speaker | `PLATFORM_ADMIN` / `speaker.verify` | Evidence note required; status history retained |
| API-062 | Moderate content | `MODERATOR` / `moderation.decide` | Decision + reason required; appealable; audit |
| API-063 | Query audit | `PLATFORM_ADMIN` / `audit.read` | Filters; export audited; no cross-org unless platform admin |
| API-064 | Grant/revoke roles | `ORGANIZER` (owner) / `member.grant` | Cannot grant a role above your own authority; no self-escalation |
| API-065 | Run retention | `PLATFORM_ADMIN` / `ops.retention` | Dry-run first; produces a deletion evidence record |

---

## 8. Field-level privacy rules (applies to every operation)

| Data | Never returned to | Never logged |
|---|---|---|
| `checkin_tokens.token_hash` | anyone (internal only) | yes |
| plaintext token / short code | any list endpoint; only the owner's own registration response | yes |
| participant contact | public, operators (except masked, for lookup), exports without a reason | yes |
| participant full name | operators on the scanner screen (first name only), public pages | yes |
| audio asset keys / presigned URLs | other tenants; logs | yes |
| transcript text of unpublished transcripts | public, search, analytics | yes |
| feedback free text | public, speakers (unless opted in), platform admins (except moderation) | yes |
| audit `context` | must not contain PII at all | yes |

## 9. Contract change process

1. Change `src/shared/contracts/**` first (types + validation), then this document, then the
   implementation, then `docs/TRACEABILITY.md`.
2. Breaking changes require: a new `/api/v2` path **or** a documented migration window with both
   shapes served, plus a task in `TASKS.md`.
3. Every operation must state its **idempotency** and **concurrency** behaviour; a PR that adds an
   operation without both is incomplete.
4. New endpoints must be added to the isolation test suite manifest (`docs/testing/STRATEGY.md`).
