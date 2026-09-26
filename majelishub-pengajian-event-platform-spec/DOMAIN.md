# DOMAIN MODEL

Aggregates, their ownership, their invariants, and the boundaries between them.
Types live in `src/domain/<entity>/`; this document is the specification they must express.

Read with: `DATA_MODEL.md` (persistence), `STATE_MACHINE.md` (transitions), `EVENTS.md`
(domain events), `ARCHITECTURE.md` §4 (module boundaries).

---

## 1. Aggregate inventory — and whether each is necessary

The brief proposed a longer list. Two things happened in this design: some proposed models were
**merged** (they had no independent lifecycle), and one was **split**. Every model below must
justify its existence; "we might need it later" is not a justification.

| Aggregate | Root | Necessary? | Why (merge/lifecycle test) |
|---|---|---|---|
| `Organization` | yes | **Yes** | Tenant boundary; owns memberships and settings; cannot be derived. |
| `OrganizationMember` | entity under Organization | **Yes** | A person's roles are scoped to a tenant; identity is global (ADR-0017). |
| `Mosque` | yes | **Yes** | Durable public location with its own page and data. |
| `Venue` | entity under Mosque | **Yes** (not a merge) | A mosque has several usable spaces with independent capacity and entrance notes; capacity and check-in attribution live on the venue. Modelled as a **child entity**, not a separate aggregate root — venues have no lifecycle independent of their mosque. |
| `Speaker` | yes | **Yes** | Appears across organizations; has a public identity and verification state. |
| `KajianProgram` | yes | **Yes** | The recurrence rule and defaults. **Distinct from** `KajianEvent` (see §3). |
| `KajianEvent` | yes | **Yes** | One occurrence with a date, venue, speaker, policies. |
| `Registration` | yes | **Yes** | A participant's commitment; owns the check-in token; has states. |
| `CheckInToken` | entity under Registration | **Yes** | A secret with its own lifecycle (issue, rotate, revoke, expire). **Not** merged into `Registration` because its hash/rotation/retention differ from registration data (`RETENTION.md`). |
| `AttendanceRecord` | yes (own root, not under Registration) | **Yes** | Exists for **walk-ins with no registration**, so it cannot be a child of `Registration`. This is the single most important structural decision in the model (ADR-0025). |
| `RecordingSession` | yes | **Yes** | A live attempt with its own lifecycle, recovery state and device metadata. |
| `RecordingChunk` | entity under RecordingSession | **Yes** | Ordered, idempotent upload unit with its own storage key and hash. |
| `AudioAsset` | yes | **Yes** | A durable stored artefact (RAW/NORMALIZED/TRANSCRIPTION_DERIVATIVE/EXPORT) with its own lifecycle and retention. A session produces assets; assets outlive sessions. |
| `TranscriptionJob` | yes | **Yes** | An asynchronous attempt against a provider, with retries and provider metadata. |
| `Transcript` | yes | **Yes** | The document identity (event + audio asset + policy + status + approval pins). |
| `TranscriptSegment` | entity under Transcript | **Yes** | Ordered, addressable unit (timestamps enable navigation). |
| `TranscriptRevision` | entity under Transcript | **Yes** | Immutable history (ADR-0023). |
| `ContentChapter` | entity under Transcript/AudioAsset | **Yes** (P1) | Time markers for navigation; merge-able into TranscriptSegment later but distinct authoring intent. |
| `ContentMaterial` | entity under KajianEvent | **Yes** | References provided by organizer/speaker; no lifecycle of its own beyond the event. |
| `Feedback` | yes | **Yes** | Independent lifecycle, anonymity semantics (ADR-0016). |
| `NotificationIntent` | yes | **Yes** | Delivery record; dedupe key; the audit answer to "was this sent?". |
| `DomainEvent` (outbox) | yes | **Yes** | Transactional outbox for handlers (`EVENTS.md`). |
| `AuditEvent` | yes | **Yes** | Append-only, different retention from everything else. |
| `OperationalAlert` | yes | **Yes** | Actionable, deduplicated, dismissible; distinct from metrics. |
| `Invitation` | entity under Organization/Event | **Yes** (P1) | Grants registration rights for `INVITATION` events; a capability, like the check-in token. |
| `SpeakerVerification` | entity under Speaker | **Yes** | Evidence + verifier + timestamp; must be auditable and revocable. |
| `Device` (operator device label) | value object on AttendanceRecord/RecordingSession | **No** | A label string, not an entity. Do not build a device registry. |
| `PrayerTimeSource` | configuration | **No** (config, not a table) | Deployment configuration + optional cached provider data (`ADR-0018`). |
| `ParticipantProfile` | — | **No — deliberately absent** | There is no participant account/profile aggregate. A participant is identified by a contact channel and, per event, by a `Registration`. Building profiles of jamaah is a privacy anti-goal (`PRIVACY.md`). |
| `SpeakerRating` / `PopularityScore` / `Follower` | — | **No — forbidden** | ADR-0024. |
| `Payment` / `Donation` | — | **No — out of scope** | `PRD.md` NG-1. |
| `ModerationReport` / `ModerationDecision` | yes | **Yes** (P1) | Independent lifecycle, audit requirements. |

## 2. Aggregate ownership table

| Aggregate | Owning module | May be read by | May be written by |
|---|---|---|---|
| Organization / Member | `organizations` | identity, all modules (scoped) | organizations |
| Speaker | `speakers` | programs, events, content, moderation | speakers (+ moderation for visibility suspends) |
| Mosque / Venue | `mosques` | programs, events, checkin, content | mosques |
| KajianProgram | `programs` | events, content, notifications | programs |
| KajianEvent | `events` | registration, checkin, attendance, recording, content, analytics | events |
| Registration | `registration` | checkin, attendance, notifications, feedback | registration |
| CheckInToken | `checkin` (issued for `registration`) | checkin | checkin |
| AttendanceRecord | `attendance` | events, analytics, content | attendance |
| RecordingSession / Chunk | `recording` | audio, analytics, telemetry | recording |
| AudioAsset | `audio` | transcription, content | audio |
| TranscriptionJob | `transcription` | audio, analytics | transcription |
| Transcript / Segment / Revision | `transcription` | content, search, moderation | transcription (review workflow) |
| Feedback | `feedback` | analytics (aggregate only) | feedback |
| NotificationIntent | `notifications` | analytics | notifications (+ emitting modules create intents) |
| DomainEvent (outbox) | each module writes its own rows | handlers | the writing module |
| AuditEvent | `audit` | admin query surface | all modules (append only) |
| OperationalAlert | `analytics` | organizer UI, operator UI | analytics |

**Rule:** a module never writes another module's tables. Cross-module effects are service calls
or domain events.

## 3. The Program vs. Event distinction (critical)

```
KajianProgram  "Kajian Ba'da Subuh"
  ├── recurrence: weekly, Sunday, prayer-relative (ba'da Subuh)
  ├── default mosque: Masjid Al-Ikhlas · venue: Ruang Utama
  ├── default speaker: (none — rotated)
  └── generates →
        KajianEvent  "Kajian Ba'da Subuh — Minggu, 11 Oktober 2026"  · Ustadz X
        KajianEvent  "Kajian Ba'da Subuh — Minggu, 18 Oktober 2026"  · Ustadz Y
        KajianEvent  "Kajian Ba'da Subuh — Minggu, 25 Oktober 2026"  · Ustadz Z (cancelled)
```

Rules that follow from the distinction:

1. A `KajianEvent` may exist **without** a program (a one-off kajian).
2. A program **never** has attendance, registration, recording or transcripts — only its events do.
3. Editing a program's schedule does **not** rewrite history: already-generated events keep
   their own dates unless explicitly changed; future ungenerated occurrences pick up the change.
4. Cancelling one event does not pause the program (`FR-PROGRAM-005` handles pausing).
5. A program's defaults (mosque, venue, speaker, policies) are *proposals* when generating events,
   not references that keep overriding them.

## 4. Key invariants

### 4.1 Organization & mosque
- `I-ORG-1` Every scoped row has `organization_id`; composite FKs prevent cross-org references.
- `I-ORG-2` A member's roles are valid role keys; assigning a role requires the granting actor to
  hold an authority that covers it (`AUTHZ-MATRIX.md` §Rules: no self-escalation).
- `I-MOSQUE-1` A venue belongs to exactly one mosque.
- `I-MOSQUE-2` A mosque's timezone is a valid IANA zone; all events at that mosque use it.
- `I-MOSQUE-3` Coordinates, when present, are valid lat/long pairs.

### 4.2 Events
- `I-EVENT-1` An event's venue (when set) belongs to the event's mosque.
- `I-EVENT-2` `endsAt >= startsAt` when both are present; duration ≤ 12 h (a sanity bound).
- `I-EVENT-3` Publishing requires: title, mosque, venue (or explicit "venue TBD" flag), speaker,
  a resolved or estimated start time, and explicit registration/attendance/recording/transcription
  policies. No policy may be "unset" at publish time.
- `I-EVENT-4` An event in a terminal state (`CANCELLED`, `ARCHIVED`) accepts no new registrations
  and no check-ins.
- `I-EVENT-5` `recordingPolicy = NONE` forbids creating recording sessions; `transcriptionPolicy`
  other than `NONE` requires an audio asset.
- `I-EVENT-6` A published event's speaker change is recorded (audit) and notified; the event keeps
  a single `speaker_id` (a panel is modelled as a speaker entity of type `PANEL`, not as a list —
  see §6 rationale).

### 4.3 Registration & capacity
- `I-REG-1` A registration belongs to exactly one event and inherits its `organization_id`.
- `I-REG-2` `REGISTERED` count for an event ≤ capacity when `capacityLimited`. Waitlisted
  registrations do not consume capacity.
- `I-REG-3` One registration per (event, contact identity) — uniqueness on a normalised contact
  hash, so double submissions converge (`FR-REG-005`).
- `I-REG-4` A registration in `CANCELLED` cannot transition to `CHECKED_IN`.
- `I-REG-5` A registration's `participantCount` is 1–20 (a declared count, never named persons).
- `I-REG-6` A check-in token exists iff the registration has ever been `REGISTERED` or
  `WAITLISTED`; when a waitlisted registration is promoted, the **same** registration and token
  are reused (no duplicate — `FR-REG-014`).

### 4.4 Attendance
- `I-ATT-1` At most one attendance record per (event, registration).
- `I-ATT-2` At most one attendance record per (event, walk-in identity).
- `I-ATT-3` `checked_in_at` is immutable once written; corrections are separate, reasoned,
  audited amendments (`FR-ATTEND-004`).
- `I-ATT-4` Walk-ins are permitted only when the event's attendance mode allows
  (`REGISTRATION_OPTIONAL` | `NONE` | `WALK_IN` registration mode).
- `I-ATT-5` `NO_SHOW` is **derived**, never stored as a state transition of the participant: it is
  a report fact computed after the check-in window closes (`ATTENDANCE.md`).

### 4.5 Recording & audio
- `I-AUD-1` A recording session belongs to exactly one event and carries the event's recording
  policy snapshot at start time (policy changes mid-session do not retroactively alter it).
- `I-AUD-2` Chunks are unique per (session, sequence); sequences are dense from 0 on completion
  unless an explicit gap is recorded with a reason.
- `I-AUD-3` An `AudioAsset` is immutable once created; processing creates **new** assets.
- `I-AUD-4` Only one `NORMALIZED` asset per (session, processing profile) is current at a time;
  reprocessing supersedes rather than overwrites (the previous asset is retained or deleted by
  retention policy, and the decision is recorded).
- `I-AUD-5` The archive master (`RAW`) is never deleted as a side effect of producing a derivative.

### 4.6 Transcription & content
- `I-TRN-1` A transcript belongs to exactly one event and at most one audio asset.
- `I-TRN-2` `published_at IS NOT NULL ⇒ approved_by IS NOT NULL` (ADR-0012, database-level).
- `I-TRN-3` Revisions are append-only and strictly increasing per transcript (ADR-0023).
- `I-TRN-4` `source = MACHINE` until a human saves a revision; then `HUMAN`/`MIXED` per the
  revision history (a single segment edited by a human makes the transcript `MIXED` unless the
  machine draft was fully replaced — recorded precisely, never guessed).
- `I-TRN-5` A published transcript serves `published_revision_id` content, not "current".
- `I-TRN-6` `recordingPolicy = INTERNAL` ⇒ no public audio or transcript, and the UI states it.

### 4.7 Feedback
- `I-FBK-1` One feedback submission per (event, participant identity) unless anonymous, in which
  case rate limiting is per capability token hash and not person-linked.
- `I-FBK-2` `is_anonymous = true ⇒ no registration_id, no contact` (ADR-0016).
- `I-FBK-3` No feedback aggregate may be exposed publicly (`FR-FEEDBACK-005`).

### 4.8 Cross-cutting
- `I-X-1` Every state change emits exactly one domain event (in the same transaction).
- `I-X-2` Every security-relevant or integrity-relevant change emits an audit event.
- `I-X-3` Deletion (as opposed to state change) happens only through retention or an explicit
  data-subject request, both audited (`RETENTION.md`).

## 5. Value objects (no identity, immutable)

| Value object | Fields | Rules |
|---|---|---|
| `EventTime` | `mode: ABSOLUTE \| PRAYER_RELATIVE`, `instant?`, `prayerRef?`, `timezone`, `isEstimate` | ADR-0018; never stores a naive local time |
| `PrayerRef` | `anchor: PrayerName`, `direction`, `offsetMinutes` | Conversion requires a `PrayerTimeSource` |
| `Address` | lines, area, city, province, postal, country | Free-form lines + structured locality |
| `GeoPoint` | lat, lng | Validated ranges |
| `ContactChannel` | `type: EMAIL \| WHATSAPP \| SMS`, `value` | Stored normalised + a hash for uniqueness/dedupe; not exposed publicly |
| `Capacity` | `limit`, `waitlistEnabled` | Present only for `CAPACITY_LIMITED` |
| `RecordingPolicy` / `TranscriptionPolicy` / `AttendanceMode` / `RegistrationMode` | enums | Explicit at publish time (`I-EVENT-3`) |
| `CheckInTokenValue` | `token`, `shortCode` | Never logged; never in a URL of a third-party service |
| `SegmentCertainty` | `UNVERIFIED \| UNCERTAIN \| VERIFIED` | Reviewer-set only (ADR-0012) |
| `TranscriptProvenance` | `source`, `approvedBy?`, `approvedAt?`, `revisionId` | Rendered in the UI |
| `TimeRange` | `startMs`, `endMs` | `startMs < endMs` within an audio asset |

## 6. Modelling decisions worth remembering

1. **`AttendanceRecord` is a root, not a child of `Registration`.** Walk-ins have no registration;
   the attendance fact must exist without one. Everything else about attendance follows from this.
2. **Speaker is organization-independent.** The same ustadz appears at many mosques; profiles are
   global, with affiliation text that may change. Verification is platform-level.
3. **A panel of speakers is modelled as a `Speaker` of type `PANEL` with its own name** ("Tim
   Kajian"), not as a list on the event. Rationale: keeps a single `speaker_id` on events and
   prevents a many-to-many that would need its own attendance/content semantics. (Documented as a
   P2 extension if per-member attribution becomes necessary.)
4. **No participant profile, ever.** Participants are ephemeral identities per event plus a
   contact channel. This is the single largest privacy decision in the model.
5. **Tokens are separate entities** from the things they authorise, with their own retention.
6. **Feedback is not attached to speakers as a scored attribute.** It is attached to an event
   with an optional speaker reference for operational routing (ADR-0016, ADR-0024).
7. **`ContentMaterial` is a reference, not a mirror.** We store a URL and a description; we do not
   host arbitrary third-party files (upload abuse surface, `SECURITY.md` §Uploads).
8. **`OperationalAlert` is a first-class entity**, not a log line: it can be acknowledged,
   deduplicated and shown to organizers (`FR-ANALYTICS-002`).
