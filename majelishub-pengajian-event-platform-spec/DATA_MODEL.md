# DATA MODEL

Conceptual persistence specification. **No migrations are written in Phase 0** (`TASKS.md` §Hard
limits). This document is the contract that migrations must satisfy when VS-1..VS-10 implement it.

Conventions for every entity below:

- **Purpose / Owner / Key / FKs / Cardinality / Uniques / Checks / Indexes / Lifecycle /
  Deletion / Retention / Volume.**

Global conventions:

- Primary keys: `id` = **UUIDv7** (time-sortable) stored as `uuid`. Public slugs are separate.
- Timestamps: `timestamptz`, always UTC; `created_at`, `updated_at` on every mutable table;
  domain-specific times (`published_at`, `approved_at`, `checked_in_at`) never reused.
- Money/quantities: integers. Durations: milliseconds (`*_ms`) or seconds for jobs (`*_s`).
- Enums are PostgreSQL `enum` types once their value sets are stable (they are, by
  `STATE_MACHINE.md`), otherwise text + `CHECK`.
- Soft delete is **not** used as a general mechanism. Lifecycle states carry the semantics
  (`ARCHIVED`, `CANCELLED`, `UNPUBLISHED`); hard deletion happens only via retention or a
  data-subject request, and is audited.
- Every scoped table carries `organization_id` for tenancy (ADR-0017) with a composite FK to
  prevent cross-tenant references.
- Expected volumes are per deployment at 12 months for a mid-size deployment (≈40 mosques,
  ≈1,200 events, ≈120k registrations, ≈60k audio minutes).

---

## 1. identity / organizations

### `users`
| Aspect | Spec |
|---|---|
| Purpose | Organizer/volunteer/reviewer/admin account (never a participant) |
| Owner | `identity` |
| PK | `id` |
| Uniques | `email` (lowercased), `phone_e164` (nullable), `passkey credentials` unique per user |
| Checks | `email ~* '^[^@]+@[^@]+$'`, `blocked_until IS NULL OR blocked_reason IS NOT NULL` |
| Indexes | `email`, `phone_e164`, `last_seen_at DESC` |
| Lifecycle | invited → active → (suspended) → deleted |
| Deletion | hard delete on request; audit events remain with actor id replaced by a tombstone reference |
| Retention | until account deletion; sessions 30 days (`RETENTION.md`) |
| Volume | 10²–10⁴ |

### `organizations`
| Aspect | Spec |
|---|---|
| Purpose | The tenant |
| Owner | `organizations` |
| PK / FK | `id` |
| Uniques | `slug` |
| Checks | `timezone` in IANA catalogue (validated in app), `kind IN ('MOSQUE','COMMUNITY','FOUNDATION','OTHER')` |
| Indexes | `slug`, `(is_published) WHERE is_published` |
| Lifecycle | active → suspended → deleted |
| Deletion | hard delete only after all dependent data is deleted; requires platform admin + audit |
| Retention | life of deployment |
| Volume | 1–500 |

### `organization_members`
| Aspect | Spec |
|---|---|
| Purpose | Membership + roles (scoped to organization, optionally to mosques) |
| Owner | `organizations` |
| PK / FKs | `organization_id → organizations`, `user_id → users`, `mosque_ids uuid[]` (optional subset) |
| Uniques | `UNIQUE (organization_id, user_id)` |
| Checks | `roles <@ ARRAY[...valid role keys...]` and `cardinality(roles) >= 1` |
| Indexes | `(organization_id, user_id)`, `(user_id)` |
| Lifecycle | invited → active → removed |
| Deletion | hard delete on membership removal (audit keeps the action) |
| Retention | life of membership |
| Volume | 10¹–10³ |

### `invitations` (organizer invites; distinct from event invitations)
| Aspect | Spec |
|---|---|
| Purpose | A user joins an organization with roles |
| PK / FKs | `id`, `organization_id`, `invited_by → users` |
| Uniques | `token_hash` (never store plaintext) |
| Checks | `expires_at > created_at`, `accepted_at IS NULL OR accepted_by IS NOT NULL` |
| Indexes | `token_hash`, `(organization_id, email) WHERE accepted_at IS NULL` |
| Retention | 90 days after expiry/accepted |
| Volume | 10²/year scale (low) |

---

## 2. mosques

### `mosques`
| Aspect | Spec |
|---|---|
| Purpose | A place of worship / community site |
| Owner | `mosques` |
| PK / FKs | `id`, `organization_id → organizations` |
| Uniques | `UNIQUE (organization_id, slug)`; partial unique on `(latitude, longitude, lower(name))` to reduce duplicates |
| Checks | `kind IN ('MASJID','MUSHOLLA','SURAU','HALL','CAMPUS','OFFICE','OTHER')`, lat ∈ [−90,90], lng ∈ [−180,180], `timezone` valid |
| Indexes | `(organization_id)`, `lower(name) gin_trgm_ops`, GiST/`earthdistance`-style geo index (or a btree on rounded coords initially), `(is_active) WHERE is_active` |
| Lifecycle | draft → active → inactive/closed → deleted |
| Deletion | only when no non-archived events reference it; otherwise `is_active=false` |
| Retention | life of deployment |
| Volume | 10¹–10³ |

### `venues` (rooms/halls)
| Aspect | Spec |
|---|---|
| Purpose | A usable space inside a mosque with capacity and access notes |
| Owner | `mosques` |
| PK / FKs | `id`, `mosque_id → mosques` (composite `(mosque_id, organization_id)`) |
| Uniques | `UNIQUE (mosque_id, slug)` |
| Checks | `capacity IS NULL OR capacity > 0`, `floor_label` free text |
| Indexes | `(mosque_id)`, `(mosque_id, is_active)` |
| Lifecycle | active → inactive → deleted |
| Deletion | blocked while events reference it (or events are reassigned first) |
| Retention | life of deployment |
| Volume | 10¹–10³ |

### `mosque_facilities` (value rows: parking, wudu, women's area, wheelchair, transport notes)
| Aspect | Spec |
|---|---|
| Purpose | Structured facility facts + free-text entrance instructions |
| Owner | `mosques` |
| PK / FKs | `id`, `mosque_id → mosques` |
| Uniques | `UNIQUE (mosque_id, facility_key)` |
| Checks | `facility_key IN (...)` (closed vocabulary), `availability IN ('YES','NO','LIMITED','UNKNOWN')` — `UNKNOWN` is a first-class honest value |
| Indexes | `(mosque_id)`, `(facility_key) WHERE availability = 'YES'` (directory filtering) |
| Retention | life of deployment |
| Volume | ~10 rows per mosque |

### `mosque_contacts`
| Aspect | Spec |
|---|---|
| Purpose | Contact info with explicit visibility (never public by default) |
| PK / FKs | `id`, `mosque_id`, `organization_id` |
| Checks | `visibility IN ('PRIVATE','ORGANIZERS','PUBLIC')` (default `ORGANIZERS`) |
| Indexes | `(mosque_id)` |
| Retention | life of deployment |
| Volume | 10² rows |

---

## 3. speakers

### `speakers`
| Aspect | Spec |
|---|---|
| Purpose | A public teacher/speaker identity (global, not tenant-owned data in the sense of a mosque) |
| Owner | `speakers` |
| PK / FKs | `id`, `primary_organization_id → organizations` (creator/scoped editor), `claimed_by_user_id? → users` |
| Uniques | `slug` |
| Checks | `display_name <> ''`, `type IN ('INDIVIDUAL','PANEL')`, `listing_state IN ('LISTED','UNLISTED','SUSPENDED')` |
| Indexes | `slug`, `lower(display_name) gin_trgm_ops`, `(listing_state)` |
| Lifecycle | created → listed ↔ unlisted → (suspended) → deleted (only if no published content or after content resolution) |
| Deletion | unlisting is the default answer; deletion requires content ownership resolution (`PRD.md` E15) |
| Retention | life of deployment |
| Volume | 10¹–10⁴ |
| Note | **No columns** for followers, ratings, popularity, or counts of any kind (ADR-0024) |

### `speaker_topics` (areas of study)
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `speaker_id`, `topic_key` (controlled vocabulary per deployment, `FR-SPEAKER-008`) |
| Uniques | `UNIQUE (speaker_id, topic_key)` |
| Indexes | `(topic_key)` |
| Volume | ~5 per speaker |

### `speaker_verifications`
| Aspect | Spec |
|---|---|
| Purpose | Evidence-backed identity/affiliation confirmation (not a rank) |
| PK / FKs | `id`, `speaker_id`, `verified_by → users` |
| Checks | `status IN ('PENDING','VERIFIED','REJECTED','REVOKED')`, `verified_at IS NULL OR verified_by IS NOT NULL`, evidence note required for a decision |
| Indexes | `(speaker_id, status)`, `(status) WHERE status = 'PENDING'` |
| Retention | permanent (public trust record) |
| Volume | 10¹–10³ |

---

## 4. programs & events

### `kajian_programs`
| Aspect | Spec |
|---|---|
| Purpose | The routine (recurring schedule + defaults) |
| Owner | `programs` |
| PK / FKs | `id`, `organization_id`, `mosque_id`, `default_venue_id?`, `default_speaker_id?` |
| Uniques | `UNIQUE (organization_id, slug)` |
| Checks | `state IN ('ACTIVE','PAUSED','ENDED')`, recurrence validity (`freq IN ('WEEKLY','MONTHLY','CUSTOM')`, `by_weekday` 0..6 or ISO 1..7 per convention, `month_mode IN ('NTH_WEEKDAY','DAY_OF_MONTH')`, `custom_dates` non-empty iff `freq='CUSTOM'`), `until >= starts_on` |
| Indexes | `(organization_id)`, `(mosque_id, state)`, `(default_speaker_id)` |
| Lifecycle | active ⇄ paused → ended → archived |
| Deletion | only when no events reference it, otherwise `ENDED` |
| Retention | life of deployment |
| Volume | 10²–10³ |

### `kajian_events`
| Aspect | Spec |
|---|---|
| Purpose | One occurrence |
| Owner | `events` |
| PK / FKs | `id`, `organization_id`, `mosque_id`, `venue_id?`, `speaker_id`, `program_id?`, `created_by → users` |
| Uniques | `UNIQUE (organization_id, slug)`; `UNIQUE (program_id, starts_at)` (prevents duplicate generation) |
| Checks | `status IN (...)` (see `STATE_MACHINE.md`), `ends_at IS NULL OR ends_at >= starts_at`, `ends_at IS NULL OR ends_at < starts_at + interval '12 hours'`, `(start_mode='ABSOLUTE') = (starts_at IS NOT NULL)`, `registration_mode IN (...)`, `attendance_mode IN (...)`, `recording_policy IN (...)`, `transcription_policy IN (...)`, `capacity IS NULL OR capacity > 0`, `published_at IS NULL OR (title <> '' AND speaker_id IS NOT NULL AND mosque_id IS NOT NULL)` |
| Indexes | `(organization_id, starts_at DESC)`, `(status, starts_at) WHERE status IN ('SCHEDULED','REGISTRATION_OPEN')` (public list), `(mosque_id, starts_at DESC)`, `(speaker_id, starts_at DESC)`, `(program_id, starts_at)`, GIN `tsvector` on `to_tsvector('indonesian', title || ' ' || coalesce(description,''))` |
| Lifecycle | DRAFT → … → ARCHIVED (`STATE_MACHINE.md`) |
| Deletion | never hard-delete a published/completed event; archive instead |
| Retention | event core metadata: 7 years (records for mosque reporting); registration/attendance separately (`RETENTION.md`) |
| Volume | 10³–10⁵ |

### `event_topics`, `event_materials`
| Aspect | Spec |
|---|---|
| `event_topics` | `UNIQUE (event_id, topic_key)`; index `(topic_key)` for filtering |
| `event_materials` | `id`, `event_id`, `kind IN ('KITAB','ARTICLE','PDF','SLIDE','LINK','OTHER')`, `url?` (validated https), `label`, `provided_by` — **we store references, we do not host third-party files**; `UNIQUE (event_id, url)` when url present |
| Retention | with the event |

### `event_schedule_changes` (reschedule/cancel history)
| Aspect | Spec |
|---|---|
| Purpose | Immutable record of schedule changes for notification and audit |
| PK / FKs | `id`, `event_id`, `changed_by → users` |
| Checks | `reason` required; `previous_starts_at`/`new_starts_at` recorded |
| Indexes | `(event_id, created_at DESC)` |
| Retention | with the event |

---

## 5. registration

### `registrations`
| Aspect | Spec |
|---|---|
| Purpose | A participant's commitment to attend |
| Owner | `registration` |
| PK / FKs | `id`, `event_id → kajian_events` (composite with `organization_id`), `promoted_from_waitlist_at?` |
| Uniques | `UNIQUE (event_id, contact_hash)` where `status <> 'CANCELLED'` (partial index) — enables re-registration after cancelling, prevents duplicates |
| Checks | `status IN ('REGISTERED','WAITLISTED','CANCELLED','CHECKED_IN','NO_SHOW'→derived-not-stored)`; stored status set is `('REGISTERED','WAITLISTED','CANCELLED','ATTENDED','PROMOTED')` with attendance living in `attendance_records`; `participant_count BETWEEN 1 AND 20`; `name <> ''`; `cancelled_at IS NULL OR cancellation_reason IS NOT NULL` |
| Indexes | `(event_id, status)`, `(event_id, created_at)`, `(contact_hash)`, `(organization_id, created_at DESC)` |
| Lifecycle | see `REGISTRATION.md` |
| Deletion | hard delete on data-subject request (audited); otherwise retained per policy |
| Retention | registrations 18 months after event, then anonymised/aggregated (`RETENTION.md`) |
| Volume | 10⁵–10⁶ |
| Privacy | `name` + `contact` only; optional accessibility note. **No address, DOB, gender, NIK.** |

### `checkin_tokens`
| Aspect | Spec |
|---|---|
| Purpose | The opaque capability that authorises one check-in |
| Owner | `checkin` |
| PK / FKs | `id`, `registration_id → registrations`, `event_id`, `organization_id` |
| Uniques | `UNIQUE (token_hash)`; `UNIQUE (event_id, short_code_hash)` |
| Checks | `revoked_at IS NULL OR revocation_reason IS NOT NULL`, `expires_at > created_at` |
| Indexes | `token_hash` (unique), `(registration_id, revoked_at)`, `(event_id)` |
| Storage rule | **only hashes**; the plaintext value is never stored, logged or exposed by list endpoints |
| Lifecycle | issued → active → (revoked | expired) |
| Deletion | hard delete 30 days after the event (`RETENTION.md` §QR tokens) |
| Volume | 10⁵–10⁶ |

### `waitlist_offers`
| Aspect | Spec |
|---|---|
| Purpose | A seat offered to a waitlisted participant with an expiry |
| PK / FKs | `id`, `registration_id`, `event_id`, `offered_by?` |
| Uniques | `UNIQUE (registration_id, event_id, created_at)` (an offer is one row per attempt; partial unique on active offer) |
| Checks | `expires_at > created_at`, `state IN ('OFFERED','ACCEPTED','DECLINED','EXPIRED')` |
| Indexes | `(event_id, state)`, `(registration_id)` |
| Retention | 90 days after event |
| Volume | ~10% of registrations for capped events |

---

## 6. attendance

### `attendance_records`
| Aspect | Spec |
|---|---|
| Purpose | The durable fact that someone attended |
| Owner | `attendance` |
| PK / FKs | `id`, `event_id`, `organization_id`, `venue_id?`, `registration_id?`, `walk_in_ref?`, `recorded_by → users`, `entrance_id?`, `device_label?` |
| Uniques | `UNIQUE (event_id, registration_id)`, `UNIQUE (event_id, walk_in_ref)` (partial, where walk_in_ref not null) |
| Checks | `(registration_id IS NULL) <> (walk_in_ref IS NULL)` (exactly one identity), `method IN ('QR','SHORT_CODE','NAME_LOOKUP','WALK_IN','MANUAL_CORRECTION')`, `is_corrected = false OR correction_reason IS NOT NULL`, `checked_in_at IS NOT NULL` |
| Indexes | `(event_id, checked_in_at)`, `(event_id, method)`, `(organization_id, checked_in_at DESC)`, `(registration_id)` |
| Lifecycle | created on check-in; corrected (never deleted) except by retention |
| Deletion | retention only (see `RETENTION.md`); a wrong record is corrected with a reason, not deleted |
| Retention | attendance 24 months, then aggregated (`RETENTION.md`) |
| Volume | 10⁵–10⁶ |

### `attendance_corrections`
| Aspect | Spec |
|---|---|
| Purpose | Audited amendments to attendance |
| PK / FKs | `id`, `attendance_record_id`, `corrected_by → users` |
| Checks | `reason` required (min length 8), `action IN ('ADD','MARK_PRESENT','MARK_ABSENT','FIX_TIME','FIX_VENUE')` |
| Indexes | `(attendance_record_id, created_at DESC)` |
| Retention | as audit (longer than attendance) |

### `entrances` (per venue check-in points)
| Aspect | Spec |
|---|---|
| Purpose | Multiple entrances per venue for attribution and operator assignment |
| PK / FKs | `id`, `venue_id`, `organization_id` |
| Uniques | `UNIQUE (venue_id, slug)` |
| Indexes | `(venue_id)` |
| Retention | with the venue |

---

## 7. recording & audio

### `recording_sessions`
| Aspect | Spec |
|---|---|
| Purpose | One live recording attempt |
| Owner | `recording` |
| PK / FKs | `id`, `event_id`, `organization_id`, `operator_id → users`, `venue_id?` |
| Uniques | none required beyond PK (multiple attempts are legitimate) |
| Checks | `status IN ('PREPARING','RECORDING','PAUSED','STOPPING','UPLOADING','COMPLETED','FAILED','ABANDONED','RECOVERABLE')`, `stopped_at IS NULL OR stopped_at >= started_at`, `recording_policy` snapshot not null, `chunk_seconds BETWEEN 3 AND 30`, capture config recorded (`echo_cancellation`, `noise_suppression`, `auto_gain`, `device_label`) |
| Indexes | `(event_id, status)`, `(organization_id, started_at DESC)`, `(status) WHERE status IN ('RECORDING','UPLOADING','RECOVERABLE')` (health checks) |
| Lifecycle | see `AUDIO.md` §States |
| Deletion | discarded sessions hard-deleted with their chunks per retention; completed sessions retained |
| Retention | session metadata 7 years; chunks deleted on assembly + 7 days grace |
| Volume | 10³–10⁵ |

### `recording_chunks`
| Aspect | Spec |
|---|---|
| Purpose | Ordered, idempotent upload unit |
| PK / FKs | `id`, `session_id → recording_sessions` |
| Uniques | `UNIQUE (session_id, sequence)` |
| Checks | `sequence >= 0`, `size_bytes > 0 AND size_bytes <= 8_000_000`, `duration_ms BETWEEN 1000 AND 60000`, `sha256` is 64 hex chars, `content_type IN ('audio/webm','audio/ogg','audio/mp4','audio/wav')` |
| Indexes | `(session_id, sequence)`, `(session_id, received_at DESC)` |
| Lifecycle | received → (assembled | deleted) |
| Deletion | after successful assembly + grace window (default 7 days) |
| Volume | ~720 rows per 2-hour session (10 s chunks) → 10⁵–10⁷; partitioned by month recommended at scale |

### `audio_assets`
| Aspect | Spec |
|---|---|
| Purpose | A durable stored artefact |
| Owner | `audio` |
| PK / FKs | `id`, `event_id`, `organization_id`, `session_id?`, `derived_from_asset_id?` |
| Uniques | partial: `UNIQUE (session_id, kind, profile) WHERE is_current` (one current asset per kind/profile) |
| Checks | `kind IN ('RAW','NORMALIZED','TRANSCRIPTION_DERIVATIVE','EXPORT')`, `duration_ms > 0`, `size_bytes > 0`, `storage_key` matches the naming convention, `checksum_sha256` present, `is_current` boolean, `visibility IN ('PRIVATE','ORGANIZERS','PUBLIC')` |
| Indexes | `(event_id, kind)`, `(organization_id, kind)`, `(storage_key)` unique, `(visibility, created_at) WHERE visibility='PUBLIC'` |
| Lifecycle | created → (superseded) → deleted by retention |
| Deletion | retention policy; never delete the only master while a published transcript's audio link depends on it (checked) |
| Retention | RAW/normalized: per deployment (default 24 months); derivative: 30 days after transcription |
| Volume | ~3 assets × 10³–10⁵ sessions |

### `audio_processing_jobs`
| Aspect | Spec |
|---|---|
| Purpose | Processing attempt record (normalise, remux, derive) |
| PK / FKs | `id`, `session_id`, `input_asset_id`, `output_asset_id?` |
| Checks | `status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','DEAD')`, `attempts >= 0`, `error_code IS NULL OR status = 'FAILED'` |
| Indexes | `(status, created_at)`, `(session_id)` |
| Retention | 180 days |

---

## 8. transcription

### `transcription_jobs`
| Aspect | Spec |
|---|---|
| Purpose | One asynchronous transcription attempt |
| Owner | `transcription` |
| PK / FKs | `id`, `event_id`, `audio_asset_id`, `organization_id`, `requested_by → users` |
| Uniques | partial: `UNIQUE (audio_asset_id) WHERE status IN ('QUEUED','PROCESSING')` (no duplicate in-flight jobs) |
| Checks | `status IN ('NOT_REQUESTED','QUEUED','PROCESSING','DRAFT','REVIEW_REQUIRED','APPROVED','PUBLISHED','FAILED')`, `provider_id <> ''`, `attempts >= 0`, `language_hints` is a non-empty array for non-`NONE` policies, `error_code IS NULL OR status = 'FAILED'` |
| Indexes | `(status, created_at)`, `(event_id)`, `(organization_id, status)`, `(provider_id, created_at DESC)` (cost/quality analysis) |
| Retention | job metadata 24 months; raw provider payload artefact 30 days |
| Volume | 10³–10⁵ |

### `transcripts`
| Aspect | Spec |
|---|---|
| Purpose | The document identity and publication state |
| PK / FKs | `id`, `event_id`, `organization_id`, `audio_asset_id?`, `job_id?` |
| Uniques | `UNIQUE (event_id)` (one transcript per event for MVP; multiple languages are a documented extension) |
| Checks | `status IN ('DRAFT','REVIEW_REQUIRED','APPROVED','PUBLISHED','UNPUBLISHED')`, `source IN ('MACHINE','HUMAN','MIXED')`, **`published_at IS NULL OR approved_by IS NOT NULL`** (ADR-0012), `published_at IS NULL OR published_revision_id IS NOT NULL`, `unpublished_at IS NULL OR unpublish_reason IS NOT NULL`, `version >= 1` |
| Indexes | `(event_id)` unique, `(status, updated_at)`, `(organization_id, status)`, `(approved_by, approved_at DESC)` |
| Lifecycle | see `STATE_MACHINE.md` §Transcription |
| Retention | transcript + revisions: 7 years if published; drafts 12 months after event if never published |
| Volume | 10³–10⁵ |

### `transcript_segments`
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `transcript_id` (composite `(transcript_id, organization_id)`) |
| Uniques | `UNIQUE (transcript_id, ordinal)` |
| Checks | `start_ms >= 0`, `end_ms > start_ms`, `end_ms <= duration_ms + 2000` (tolerance), `certainty IN ('UNVERIFIED','UNCERTAIN','VERIFIED')`, `kind IN ('SPEECH','RECITATION','QUESTION','ANNOUNCEMENT','SILENCE','UNKNOWN')`, `char_length(text) <= 4000` |
| Indexes | `(transcript_id, ordinal)`, FTS: `GIN (to_tsvector('indonesian', text))` on published material (or a segment index table scoped to published revisions) |
| Lifecycle | replaced in place by edits; history lives in revisions |
| Retention | with the transcript |
| Volume | ~1,000–3,000 segments per 2-hour transcript → 10⁶–10⁸ (largest text table; recommend partitioning by transcript or archiving old years) |

### `transcript_revisions`
| Aspect | Spec |
|---|---|
| Purpose | Immutable snapshots (ADR-0023) |
| PK / FKs | `id`, `transcript_id`, `author_id → users?` (null for the machine-generated first revision) |
| Uniques | `UNIQUE (transcript_id, revision_number)` |
| Checks | `revision_number >= 1`, `source IN ('MACHINE','HUMAN','MIXED')`, `note` optional; `snapshot` JSONB valid (segments array) |
| Indexes | `(transcript_id, revision_number DESC)` |
| Lifecycle | append-only; no update/delete paths in application code |
| Retention | published transcripts' revisions: 7 years; unpublished drafts: 12 months |
| Volume | 10⁴–10⁶ |

### `transcript_flags` (reviewer annotations)
| Aspect | Spec |
|---|---|
| Purpose | "Ask the speaker", "uncertain attribution", "check Arabic" |
| PK / FKs | `id`, `transcript_id`, `segment_id?`, `created_by` |
| Checks | `kind IN ('UNCERTAIN','CHECK_ARABIC','CHECK_ATTRIBUTION','ASK_SPEAKER','OTHER')`, resolved flags require `resolved_by`/`resolved_at` |
| Indexes | `(transcript_id, resolved_at)`, `(kind)` |
| Retention | with the transcript (unresolved flags block approval — see `docs/transcription/REVIEW-WORKFLOW.md`) |

---

## 9. content

### `content_chapters`
| Aspect | Spec |
|---|---|
| Purpose | Timestamp markers for navigation |
| PK / FKs | `id`, `event_id`, `audio_asset_id`, `created_by` |
| Uniques | `UNIQUE (event_id, start_ms)` |
| Checks | `start_ms >= 0`, `label <> ''` |
| Indexes | `(event_id, start_ms)` |
| Retention | with the event |

### `content_search_documents`
| Aspect | Spec |
|---|---|
| Purpose | Denormalised search index for published content only |
| PK / FKs | `id`, `event_id`, `organization_id`, `kind IN ('EVENT','TRANSCRIPT_SEGMENT','CHAPTER','MATERIAL')`, `source_id` |
| Checks | only rows whose source is publicly visible may exist (enforced by the writer + a test) |
| Indexes | GIN `tsvector`, GIN `pg_trgm` on a normalised name field |
| Retention | rebuilt on unpublish; retained with content |
| Note | Search must never expose `INTERNAL` recordings (`FR-CONTENT-007`) |

### `moderation_reports` / `moderation_decisions`
| Aspect | Spec |
|---|---|
| Reports | `id`, `target_type IN ('EVENT','TRANSCRIPT','AUDIO','SPEAKER','COMMENT')`, `target_id`, `reported_by` (nullable for anonymous), `reason_key`, `details`, `state IN ('OPEN','TRIAGED','RESOLVED','DISMISSED')` |
| Decisions | `id`, `report_id?`, `decided_by`, `action IN ('NO_ACTION','UNPUBLISH','REQUEST_CHANGE','SUSPEND_SPEAKER','RESTORE')`, `reason` required, `appeal_state` |
| Indexes | `(state, created_at)`, `(target_type, target_id)` |
| Retention | 7 years (trust and safety) |

---

## 10. feedback, notifications, analytics, audit

### `feedback`
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `event_id`, `organization_id`, `registration_id?` (**null when anonymous**), `speaker_share_opt_in boolean`, `submitted_at` |
| Uniques | partial `UNIQUE (event_id, registration_id) WHERE registration_id IS NOT NULL` |
| Checks | **`is_anonymous = false OR (registration_id IS NULL AND contact_hash IS NULL)`**, ratings each `BETWEEN 1 AND 5` or null, `char_length(comment) <= 2000` |
| Indexes | `(event_id, submitted_at)`, `(organization_id, submitted_at)`, `(event_id, speaker_share_opt_in) WHERE speaker_share_opt_in` |
| Lifecycle | submitted → (aggregated) → raw deleted/anonimised by retention |
| Retention | raw 12 months after event, then aggregate-only (`RETENTION.md`) |
| Volume | 10⁴–10⁵ |

### `notification_intents`
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `organization_id?`, `recipient_kind IN ('REGISTRATION','USER','MOSQUE_CONTACT')`, `recipient_ref`, `channel IN ('IN_APP','EMAIL','PUSH','WHATSAPP','SMS','TELEGRAM')`, `template_key`, `payload jsonb` (**no secrets**) |
| Uniques | **`UNIQUE (dedupe_key)`** (ADR-0015) |
| Checks | `state IN ('PENDING','DISPATCHED','FAILED','DEAD_LETTERED','CANCELLED')`, `attempts >= 0`, `payload` must not contain keys named `token`, `short_code`, `otp` (enforced in app + a test) |
| Indexes | `(state, next_attempt_at)`, `(dedupe_key)` unique, `(recipient_ref, created_at DESC)` |
| Lifecycle | pending → dispatched/dead-lettered |
| Retention | 180 days |
| Volume | 10⁶ |

### `notification_preferences`
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `subject_kind IN ('USER','CONTACT')`, `subject_ref` |
| Uniques | `UNIQUE (subject_kind, subject_ref)` |
| Checks | essential classes cannot be disabled (`cancellation`, `venue_change` forced true) |
| Retention | until subject deleted |

### `domain_events` (outbox)
| Aspect | Spec |
|---|---|
| PK | `id` (`uuid`), `aggregate_type`, `aggregate_id`, `event_type`, `payload jsonb` |
| Uniques | `UNIQUE (dedupe_key)` optional per event type (e.g. `ParticipantCheckedIn:{attendanceId}`) |
| Checks | `event_type` in the registry (`EVENTS.md`); payload schema-validated at write time in app |
| Indexes | `(occurred_at)`, `(aggregate_type, aggregate_id, occurred_at DESC)`, `(dispatched_at) WHERE dispatched_at IS NULL` |
| Lifecycle | written in-transaction → dispatched by handlers → retained for audit |
| Retention | 24 months (then aggregated/archived) |
| Volume | 10⁶–10⁷ |

### `audit_events`
| Aspect | Spec |
|---|---|
| PK | `id`, `occurred_at`, `actor_kind IN ('USER','SYSTEM','PLATFORM_ADMIN')`, `actor_id?`, `acting_organization_id?`, `action_key`, `target_type`, `target_id`, `reason?`, `context jsonb` (allow-listed), `request_id`, `source_ip_hash?` |
| Checks | `action_key` in the audit registry; `reason` required for destructive/correction actions; **no PII in `context`** |
| Indexes | `(occurred_at DESC)`, `(action_key, occurred_at DESC)`, `(target_type, target_id, occurred_at DESC)`, `(actor_id, occurred_at DESC)` |
| Lifecycle | append-only; no update/delete in application code |
| Retention | 7 years (`RETENTION.md` §Audit) |
| Volume | 10⁶–10⁷ |
| Note | Allowed-hash of IP, not the IP itself (privacy) |
| Implemented (T-SEC-007, 2026-09-27) | `drizzle/0002_audit_events.sql` + `src/server/db/schema/audit.ts`: `id uuid PK DEFAULT uuidv7()`, `organization_id uuid NOT NULL → organizations(id) ON DELETE RESTRICT`, `chain_position bigint > 0`, `action_key`, `scope_kind`, `actor_user_id?`, `actor_role?`, `target_type?`, `target_id?`, `reason?` (≥ 8 chars when present), `request_id?`, `occurred_at timestamptz`, `prev_hash`, `hash`; `UNIQUE (organization_id, chain_position)`, indexes `(organization_id, occurred_at)` and `(organization_id, action_key)`. `hash` is sha256 over a canonical rendering of the whole entry **including** `prev_hash` (`src/server/audit/writer.ts`), so an edit, a gap or a reorder is detected in linear time by `src/server/audit/verify.ts`. |
| Enforcement | the application role holds SELECT+INSERT only, and a `BEFORE UPDATE/DELETE/TRUNCATE` trigger refuses mutation for any other role unless the session sets `majelishub.allow_audit_rewrite = 'on'` (documented repair switch — `majelishub_app` has no UPDATE grant at all, so it cannot reach it). RLS: an organization reads and appends only its own chain; PLATFORM scope is the documented exception (`docs/security/AUTHZ-MATRIX.md` §4.7). |
| Deviations recorded | (1) `actor_kind`, `context jsonb` and `source_ip_hash` are **not** in this slice: the writer records authorization events, where `scope_kind` + `actor_role` carry what `actor_kind` would, and no free-form context is stored at all (a `jsonb` bag is exactly where PII leaks). They arrive with the query/export surface, T-AUDIT-001/T-AUDIT-002, together with the `(target_type, target_id, occurred_at)` and `(actor_id, occurred_at)` indexes FR-AUDIT-004 needs. (2) `organization_id` is NOT NULL rather than `acting_organization_id?`: a chain is per organization, and a platform action is stored against the organization it acted on with `scope_kind = 'PLATFORM'`. |

### `operational_alerts`
| Aspect | Spec |
|---|---|
| PK / FKs | `id`, `organization_id?`, `alert_key`, `severity IN ('INFO','WARNING','CRITICAL')`, `subject_type`, `subject_id`, `dedupe_key` unique, `first_seen_at`, `last_seen_at`, `occurrences`, `acknowledged_by?`, `acknowledged_at?`, `resolved_at?` |
| Indexes | `(organization_id, resolved_at, severity)`, `(dedupe_key)` unique, `(alert_key, first_seen_at DESC)` |
| Retention | 180 days |
| Volume | 10⁴ |

### `event_daily_stats` (derived, recomputable)
| Aspect | Spec |
|---|---|
| Purpose | Dashboard and history without expensive live queries |
| PK / FKs | `id`, `event_id`, `day date`, `organization_id` |
| Checks | all counters `>= 0` |
| Indexes | `(event_id, day)`, `(organization_id, day DESC)` |
| Lifecycle | recomputed by a job; deletion safe |
| Retention | 5 years |
| Note | Never the source of truth; reconciliation job compares to `attendance_records` and alerts on drift. |

---

## 11. Invariants that must be expressed as constraints

The following are the constraints a migration **must** include (a test asserts each exists):

1. `attendance_records`: `UNIQUE (event_id, registration_id)`
2. `attendance_records`: `UNIQUE (event_id, walk_in_ref)` (partial)
3. `attendance_records`: `CHECK ((registration_id IS NULL) <> (walk_in_ref IS NULL))`
4. `transcripts`: `CHECK (published_at IS NULL OR approved_by IS NOT NULL)`
5. `transcripts`: `CHECK (published_at IS NULL OR published_revision_id IS NOT NULL)`
6. `recording_chunks`: `UNIQUE (session_id, sequence)`
7. `checkin_tokens`: `UNIQUE (token_hash)`
8. `registrations`: `UNIQUE (event_id, contact_hash) WHERE status <> 'CANCELLED'`
9. `feedback`: `CHECK (is_anonymous = false OR (registration_id IS NULL AND contact_hash IS NULL))`
10. `notification_intents`: `UNIQUE (dedupe_key)`
11. `kajian_events`: `UNIQUE (program_id, starts_at) WHERE program_id IS NOT NULL`
12. `transcript_revisions`: `UNIQUE (transcript_id, revision_number)`
13. Composite tenant FKs: every child table references `(id, organization_id)` of its parent so a
    cross-tenant reference is impossible.
14. `mosque_facilities`: `UNIQUE (mosque_id, facility_key)`

## 12. Migration policy (for when migrations are written)

1. Migrations are generated as **SQL files**, reviewed, and applied as an explicit deployment
   step — never automatically on application boot (`ADR-0020`).
2. Destructive changes (drop column/table) require: a two-release deprecation (write-only →
   stop-reading → drop) and a documented rollback note in the migration file.
3. Adding a `NOT NULL` column to a large table requires a default or a backfill step in the same
   migration, documented.
4. Index creation on large tables uses `CREATE INDEX CONCURRENTLY` and is a separate migration.
5. Every migration states: expected duration on the largest supported deployment, locking
   behaviour, and whether it is safe to run during an event.
6. **Phase 0 writes none of these.**
