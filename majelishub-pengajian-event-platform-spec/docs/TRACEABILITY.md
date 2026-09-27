# TRACEABILITY

The requirement → document → task → test chain for every stable requirement ID in `PRD.md`.
Generated from the PRD tables; **requirement IDs are the primary key and never change**.

Status legend: `SPEC` = specified in documents (the state of almost the whole project) · `SKELETON` =
contracts/ports/tests exist · `IMPL` = implemented. Since the Phase 0 freeze was lifted (2026-09-27) a
handful of rows carry `IMPL (partial — …)`: the named mechanism exists and is tested, but the
requirement is not yet satisfied end-to-end because the surfaces it speaks about do not exist yet. The
qualifier is mandatory — an unqualified `IMPL` means the requirement can be demonstrated in the product.

How to use: (1) find the requirement you are touching; (2) read the documents listed; (3) open the
task block in `TASKS.md`; (4) satisfy the tests named in `TESTING.md` §3. If a row's mapping looks
wrong, fix **this file and the owning task** — do not silently ignore the chain.

---

## 1. Summary

- Requirements tracked: **229** (`156` functional, `73` non-functional).
- Families: **26**.
- Requirements with a priority below P0: see the PRD; P0 requirements are the release gate for VS-1…VS-10.
- Tasks referenced from this file: see `TASKS.md` (Part A = tasks other documents already cite; Part B = planned inventory).
- Every requirement below additionally carries a document reference in `PRD.md` §9/§10 (its own column).

| Family | Count | Product documents | Tasks | Test layers |
|---|---:|---|---|---|
| FR-ORG | 6 | docs/security/AUTHZ-MATRIX.md · SECURITY.md §4–5 · PRIVACY.md §4 | T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 | integration/security (isolation, permissions) · unit/domain |
| FR-MOSQUE | 9 | docs/product/MOSQUES.md · DOMAIN.md · DATA_MODEL.md §mosques | T-MOSQUE-001…T-MOSQUE-005 | integration/repository · browser/forms · e2e/discovery |
| FR-SPEAKER | 8 | docs/product/SPEAKERS.md · ADR-0014 | T-SPEAKER-001…T-SPEAKER-004 | integration · e2e · unit (anti-ranking guard) |
| FR-PROGRAM | 7 | docs/product/PROGRAMS.md · ADR-0018 | T-PROGRAM-001…T-PROGRAM-005 | unit/recurrence (DST, prayer-relative) · integration (idempotency) |
| FR-EVENT | 17 | docs/product/EVENTS.md · STATE_MACHINE.md | T-EVENT-001…T-EVENT-009 | unit/transitions (exhaustive) · integration · e2e |
| FR-REG | 14 | REGISTRATION.md · API.md | T-REG-001…T-REG-012 | unit · integration (**C1**) · e2e |
| FR-CHECKIN | 16 | CHECKIN.md · docs/security/QR-SECURITY.md · ADR-0006/0026 | T-CHECKIN-001…T-CHECKIN-017 | integration (**C2**) · browser/scanner · e2e entrance drill · load |
| FR-ATTEND | 8 | ATTENDANCE.md · docs/architecture/CONCURRENCY.md · ADR-0025 | T-ATTEND-001…T-ATTEND-008 | integration (**C4/C5**) · unit/derivation · e2e/report |
| FR-AUDIO | 17 | AUDIO.md · docs/media/{CHUNK-PROTOCOL,AUDIO-PIPELINE,AUDIO-QUALITY,STORAGE}.md · ADR-0008/0009 | T-AUDIO-001…T-AUDIO-016 | integration (**C7/C8**) · browser/recorder · e2e survival drill · soak |
| FR-TRANSCRIPT | 16 | TRANSCRIPTION.md · docs/transcription/{PIPELINE,REVIEW-WORKFLOW,CODE-SWITCHING}.md · ADR-0011/0012/0023 | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | unit (no-autocorrect) · integration (**C6/C9**) · browser/editor |
| FR-CONTENT | 7 | CONTENT.md · docs/product/CONTENT-INTEGRITY.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | integration/public projection · e2e archive browse |
| FR-FEEDBACK | 8 | FEEDBACK.md · ADR-0016 | T-FEEDBACK-001…T-FEEDBACK-008 | unit (aggregate/suppression) · integration (anonymity constraint) · browser |
| FR-NOTIF | 10 | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | unit (template guard) · integration (**C10**, channel policy) |
| FR-ANALYTICS | 4 | docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | integration (audit chain, moderation SoD) · unit |
| FR-MOD | 4 | docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | integration (audit chain, moderation SoD) · unit |
| FR-AUDIT | 5 | docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | integration (audit chain, moderation SoD) · unit |
| NFR-SEC | 12 | SECURITY.md · THREAT_MODEL.md · docs/security/{AUTHZ-MATRIX,QR-SECURITY,INCIDENT-RESPONSE}.md | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | integration/security (isolation, tokens, upload abuse, permission matrix) · unit/lint |
| NFR-PRIV | 9 | PRIVACY.md · RETENTION.md · ADR-0016/0017 | T-PRIV-001…T-PRIV-003, T-REG-011, T-ATTEND-006, T-FEEDBACK-004, T-SEC-004, T-OPS-006 | integration (constraints, retention, exports) · unit (telemetry allow-list) |
| NFR-PERF | 10 | PERFORMANCE.md (P1–P40) · docs/operations/SLO.md | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | e2e/load (budgets) · integration (query plans) |
| NFR-REL | 6 | docs/architecture/{FAILURE-MODEL,CONCURRENCY}.md | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | integration (jobs, **C11**) · e2e drills · chaos steps |
| NFR-A11Y | 8 | ACCESSIBILITY.md · docs/design/DESIGN-SYSTEM.md | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | e2e/a11y (axe + keyboard script) · browser/component |
| NFR-OBS | 8 | OBSERVABILITY.md · docs/operations/SLO.md | T-OBS-001, T-OBS-002, T-OBS-003 | unit/observability · integration/tracing · ops verification |
| NFR-I18N | 4 | see §7 of this file | — | — |
| NFR-OPS | 6 | see §7 of this file | — | — |
| NFR-ETH | 4 | see §7 of this file | — | — |
| NFR-MOB | 6 | PERFORMANCE.md §budgets · docs/design/DESIGN-SYSTEM.md | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | browser/component · e2e on throttled network |
| NFR-I18N | 4 | ACCESSIBILITY.md §language · docs/transcription/CODE-SWITCHING.md | T-TRANSCRIPT-004, T-CONTENT-007 | browser (bidi, Arabic rendering) · unit (tagging) |
| NFR-OPS | 6 | DEPLOYMENT.md · OPERATIONS.md · docs/operations/{SLO,BACKUP-RESTORE}.md | T-OPS-001…T-OPS-006, T-DOCS-001 | integration/ops (smoke, restore safety) · drills |
| NFR-ETH | 4 | docs/product/CONTENT-INTEGRITY.md · ADR-0012/0014/0023/0024 | T-SPEAKER-004, T-TRANSCRIPT-014, T-FEEDBACK-006, T-CHECKIN-018 | unit (guard tests) · integration (gate) · review |

---

## 2. Functional requirements

### FR-ORG

Documents: docs/security/AUTHZ-MATRIX.md · SECURITY.md §4–5 · PRIVACY.md §4 · Tasks: T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 · Tests: integration/security (isolation, permissions) · unit/domain

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-ORG-001 | P0 | An organization (tenant) can be created with a name, type and default timezone; it owns all scoped data. | ARCHITECTURE.md | T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 | SPEC |
| FR-ORG-002 | P0 | An organization can assign members to roles from the role catalogue; a member may hold several roles. | docs/security/AUTHZ-MATRIX.md | T-SEC-002 | IMPL (partial — the nine-role catalogue is the single source of truth (`PERMISSION_KEYS`/`ROLE_KEYS`), the 53 × 9 matrix is data, and `assertCanGrantRoles` refuses self-grants, roles the actor does not hold and platform-trust roles, all proved by `tests/integration/security/permissions.test.ts`; the assignment UI/API is `T-ORG-002`) |
| FR-ORG-003 | P0 | No actor can read or mutate another organization's data through any API, page or export. | SECURITY.md | T-SEC-001 | IMPL (partial — data layer: scope-first repositories + RLS proved by `tests/integration/security/isolation.test.ts`; no API/page/export exists yet to enumerate) |
| FR-ORG-004 | P1 | An organization can set defaults used when creating events (timezone, registration mode, recording policy). | docs/product/EVENTS.md | T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 | SPEC |
| FR-ORG-005 | P1 | Roles can be scoped to a subset of mosques/venues (a volunteer responsible for one mosque only). | docs/security/AUTHZ-MATRIX.md | T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 | SPEC |
| FR-ORG-006 | P2 | Organization-level branding (logo, colour) applied to participant-facing pages. | docs/design/DESIGN-SYSTEM.md | T-ORG-001, T-ORG-002, T-ORG-003, T-SEC-001, T-SEC-002 | SPEC |

### FR-MOSQUE

Documents: docs/product/MOSQUES.md · DOMAIN.md · DATA_MODEL.md §mosques · Tasks: T-MOSQUE-001…T-MOSQUE-005 · Tests: integration/repository · browser/forms · e2e/discovery

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-MOSQUE-001 | P0 | A mosque can be created with name, type, address, coordinates and timezone. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-002 | P0 | A mosque has a public profile page listing its upcoming kajian. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-003 | P0 | A mosque exposes facilities and accessibility information (parking, women's prayer area, wudu, wheelchair access, public transport, entrance instruct… | docs/product/MOSQUES.md, ACCESSIBILITY.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-004 | P1 | A mosque stores contact information with a visibility setting; contact details are never exposed publicly by default. | PRIVACY.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-005 | P0 | A mosque can contain multiple usable venues (halls/rooms) with independent capacity. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-006 | P1 | A venue records capacity, floor/level, and its own entrance/access notes. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-007 | P1 | A venue can define check-in instructions shown to volunteers on the check-in screen. | CHECKIN.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-008 | P1 | Mosque records indicate the timezone used for all event display; coordinates are used for "near me" ordering only. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |
| FR-MOSQUE-009 | P2 | A mosque can be marked as temporarily closed/unavailable, blocking new events. | docs/product/MOSQUES.md | T-MOSQUE-001…T-MOSQUE-005 | SPEC |

### FR-SPEAKER

Documents: docs/product/SPEAKERS.md · ADR-0014 · Tasks: T-SPEAKER-001…T-SPEAKER-004 · Tests: integration · e2e · unit (anti-ranking guard)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-SPEAKER-001 | P0 | A speaker profile can be created with name, display name, biography, areas of study, organization/affiliation and photo. | docs/product/SPEAKERS.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-002 | P1 | Speaker profiles support a platform-managed verification status with a recorded verifier and evidence note. | docs/product/SPEAKERS.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-003 | P0 | A public speaker page lists upcoming kajian and past kajian. | docs/product/SPEAKERS.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-004 | P1 | A public speaker page lists published recordings and reviewed transcripts. | CONTENT.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-005 | P1 | A speaker can claim a profile and correct their own information; corrections are audited. | docs/product/SPEAKERS.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-006 | P1 | A speaker profile can be unlisted at the speaker's request without deleting past attendance records. | PRIVACY.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-007 | P0 | The system must not compute, display or export any popularity, ranking or authority metric for a speaker. | ADR-0024, FEEDBACK.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |
| FR-SPEAKER-008 | P2 | Areas of study are drawn from a controlled vocabulary configurable per deployment. | docs/product/SPEAKERS.md | T-SPEAKER-001…T-SPEAKER-004 | SPEC |

### FR-PROGRAM

Documents: docs/product/PROGRAMS.md · ADR-0018 · Tasks: T-PROGRAM-001…T-PROGRAM-005 · Tests: unit/recurrence (DST, prayer-relative) · integration (idempotency)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-PROGRAM-001 | P0 | A recurring kajian program can be defined with title, mosque, venue, default speaker, topics and a recurrence rule. | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-002 | P0 | Recurrence supports weekly (specific weekday), monthly (nth weekday or date), and custom (explicit date list). | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-003 | P0 | The system distinguishes a **Kajian Program** (the routine) from a **Kajian Event** (one occurrence with a speaker and a date). | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-004 | P1 | Events can be generated from a program for a date range, reviewed and adjusted before publishing. | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-005 | P1 | A program can be paused or ended without affecting past events. | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-006 | P2 | Program-level default registration and recording policies can be overridden per event. | docs/product/PROGRAMS.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |
| FR-PROGRAM-007 | P1 | Prayer-relative start times (e.g. ba'da Subuh) can be defined and displayed without asserting a fabricated clock time. | GLOSSARY.md | T-PROGRAM-001…T-PROGRAM-005 | SPEC |

### FR-EVENT

Documents: docs/product/EVENTS.md · STATE_MACHINE.md · Tasks: T-EVENT-001…T-EVENT-009 · Tests: unit/transitions (exhaustive) · integration · e2e

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-EVENT-001 | P0 | A kajian event can be created as a draft with title, mosque, venue, speaker, start time and timezone. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-002 | P0 | Creating an event validates required fields, that the venue belongs to the mosque, and that times are coherent (end ≥ start, start in the future for… | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-003 | P0 | An event stores start/end in UTC plus the venue IANA timezone for display. | ADR-0018 | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-004 | P1 | An event can be rescheduled, with participants notified and the change recorded in the audit log. | NOTIFICATIONS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-005 | P0 | An event has a registration mode: `OPEN`, `CAPACITY_LIMITED`, `INVITATION`, `WALK_IN`, `NO_REGISTRATION`. | REGISTRATION.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-006 | P0 | An event has an attendance mode: `REGISTRATION_REQUIRED`, `REGISTRATION_OPTIONAL`, `NONE`. | ATTENDANCE.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-007 | P0 | An event has a recording policy: `NONE`, `INTERNAL`, `PUBLISH_AUDIO`, `PUBLISH_AUDIO_AND_TRANSCRIPT`. | docs/product/CONTENT-INTEGRITY.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-008 | P0 | An event has a transcription policy: `NONE`, `TRANSCRIBE_INTERNAL`, `TRANSCRIBE_REVIEW_PUBLISH`. | TRANSCRIPTION.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-009 | P1 | An event carries topics, language, audience notes (e.g. "untuk muslimah", "kajian pemuda") and an optional kitab/reference list. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-010 | P0 | An event can be published, becoming publicly discoverable with its speaker, mosque, venue and schedule. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-011 | P0 | An event can be cancelled with a reason; registrations are cancelled and participants notified. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-012 | P1 | An event can be completed (manually or automatically after `endsAt`), freezing registration and check-in. | ATTENDANCE.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-013 | P1 | A completed event can be archived; archived events remain publicly readable but are excluded from default discovery lists. | CONTENT.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-014 | P0 | Public discovery lists upcoming published events and supports filtering by mosque, date range, topic and language. | DESIGN.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-015 | P1 | An event detail page shows speaker, mosque, venue, schedule in local time, capacity/remaining seats, registration state, accessibility notes and the… | DESIGN.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-016 | P1 | An event exposes a stable public slug for links and print materials. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |
| FR-EVENT-017 | P2 | An event can be duplicated as a template for a one-off session. | docs/product/EVENTS.md | T-EVENT-001…T-EVENT-009 | SPEC |

### FR-REG

Documents: REGISTRATION.md · API.md · Tasks: T-REG-001…T-REG-012 · Tests: unit · integration (**C1**) · e2e

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-REG-001 | P0 | A participant can register for a published event whose mode permits it, in a single short form. | REGISTRATION.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-002 | P0 | Registration collected data is limited to: name, one contact channel, participant count, and an optional accessibility request. | PRIVACY.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-003 | P0 | A successful registration issues exactly one opaque check-in token per registration. | ADR-0006, CHECKIN.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-004 | P0 | Registration respects capacity; when full and the event allows it, the registrant is waitlisted rather than rejected without explanation. | REGISTRATION.md | T-REG-009 | SPEC |
| FR-REG-005 | P0 | Registration is idempotent under retry: the same client submission cannot create two registrations. | REGISTRATION.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-006 | P0 | A participant can cancel their registration before the event ends; the seat is released and an offer is made to the next waitlisted participant. | REGISTRATION.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-007 | P1 | For `INVITATION` events, a registrant needs a valid invitation to register; generic links never grant access. | SECURITY.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-008 | P0 | For `WALK_IN` events, no registration is required and attendance is recorded at the entrance. | CHECKIN.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-009 | P1 | A registrant can view their registration and QR again without creating a new registration. | DESIGN.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-010 | P1 | Registration supports more than one participant count per registration only as a declared count; per-person identities are never required. | PRIVACY.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-011 | P1 | The participant can request an accessibility accommodation; the request is visible only to organizers. | ACCESSIBILITY.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-012 | P1 | Organizers can close registration manually before capacity or time thresholds are reached. | REGISTRATION.md | T-REG-011 | SPEC |
| FR-REG-013 | P2 | Registration can collect an optional free-text "how did you hear about this?" for organizer analytics, without identification. | docs/product/EVENTS.md | T-REG-001…T-REG-012 | SPEC |
| FR-REG-014 | P1 | Waitlist promotion is explicit and notified; a promoted participant's token is the same registration's token (no duplicate). | REGISTRATION.md | T-REG-011 | SPEC |

### FR-CHECKIN

Documents: CHECKIN.md · docs/security/QR-SECURITY.md · ADR-0006/0026 · Tasks: T-CHECKIN-001…T-CHECKIN-017 · Tests: integration (**C2**) · browser/scanner · e2e entrance drill · load

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-CHECKIN-001 | P0 | A volunteer can open a check-in screen for one event and one venue, with the camera scanning QR codes. | CHECKIN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-002 | P0 | The check-in screen resolves the current event and entrance from the operator's assignment, so the wrong event cannot be silently scanned. | CHECKIN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-003 | P0 | Camera permission failure degrades to manual entry (type/speak a short human-readable code) without blocking the entrance. | ACCESSIBILITY.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-004 | P0 | A valid token for the correct event creates at most one attendance record; repeat scans return an explicit "already checked in" result with the time… | CHECKIN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-005 | P0 | Tokens that belong to a different event produce a distinct, unambiguous error that names neither participant nor event details beyond what the operat… | SECURITY.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-006 | P0 | Cancelled registrations cannot check in and produce an explicit result with the manual path offered. | CHECKIN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-007 | P0 | Expired tokens cannot check in, but a valid registration for the event still has a manual path. | RETENTION.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-008 | P0 | A walk-in participant can be registered at the entrance in one short interaction (name + optional contact) and immediately counted. | CHECKIN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-009 | P0 | Check-in works across multiple entrances/devices simultaneously and converges on one attendance record per person. | docs/architecture/CONCURRENCY.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-010 | P0 | The scanner gives immediate, large, unambiguous success/failure feedback and automatically resumes scanning for the next person. | DESIGN.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-011 | P0 | The QR payload contains no personal data — only an opaque token. | ADR-0006, SECURITY.md | T-CHECKIN-003 | SPEC |
| FR-CHECKIN-012 | P1 | The operator can see a live count of checked-in attendees and the event's remaining capacity. | ATTENDANCE.md | T-CHECKIN-003 | SPEC |
| FR-CHECKIN-013 | P1 | Detected token rotation: a registration's token can be re-issued (lost/stolen phone) and the old token invalidated, with the change audited. | SECURITY.md | T-CHECKIN-018 | SPEC |
| FR-CHECKIN-014 | P1 | Check-in operations are attributable: who scanned, at which device/entrance, at what time. | AUDIT, FR-AUDIT-003 | T-CHECKIN-016 | SPEC |
| FR-CHECKIN-015 | P2 | Operator sees a per-venue throughput figure (check-ins per minute) to decide whether to open another entrance. | PERFORMANCE.md | T-CHECKIN-001…T-CHECKIN-017 | SPEC |
| FR-CHECKIN-016 | P1 | Check-in degrades gracefully on unstable networks: the UI distinguishes "not yet confirmed" from "failed", and never reports success while offline. | docs/attendance/OFFLINE-EVALUATION.md | T-CHECKIN-014 | SPEC |

### FR-ATTEND

Documents: ATTENDANCE.md · docs/architecture/CONCURRENCY.md · ADR-0025 · Tasks: T-ATTEND-001…T-ATTEND-008 · Tests: integration (**C4/C5**) · unit/derivation · e2e/report

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-ATTEND-001 | P0 | Attendance is stored as one durable record per (event, registration) or (event, walk-in), never as a mutable count. | ATTENDANCE.md | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-002 | P0 | Registered-but-not-arrived participants are reported as `NO_SHOW` only after the event's check-in window closes. | ATTENDANCE.md | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-003 | P0 | Organizers see a summary distinguishing Registered / Checked In / Walk-In / No Show / Cancelled. | ATTENDANCE.md | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-004 | P1 | Organizers can correct an attendance record manually (e.g. arrived without a phone); corrections require a reason and are audited. | FR-AUDIT-003 | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-005 | P1 | Attendance can be exported (CSV) with a field-selection step that excludes personal data by default. | PRIVACY.md | T-ATTEND-006 | SPEC |
| FR-ATTEND-006 | P1 | Attendance figures are never presented with false precision: when data is incomplete the UI says so explicitly. | ATTENDANCE.md | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-007 | P2 | Per-venue attendance split when an event spans multiple venues. | ATTENDANCE.md | T-ATTEND-001…T-ATTEND-008 | SPEC |
| FR-ATTEND-008 | P1 | Attendance records are retained on a schedule separate from registration data. | RETENTION.md | T-ATTEND-001…T-ATTEND-008 | SPEC |

### FR-AUDIO

Documents: AUDIO.md · docs/media/{CHUNK-PROTOCOL,AUDIO-PIPELINE,AUDIO-QUALITY,STORAGE}.md · ADR-0008/0009 · Tasks: T-AUDIO-001…T-AUDIO-016 · Tests: integration (**C7/C8**) · browser/recorder · e2e survival drill · soak

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-AUDIO-001 | P0 | An operator can start, pause, resume and stop a recording session for an event from a browser. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-002 | P0 | Microphone permission states are handled explicitly, including permanent denial with instructions. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-003 | P1 | The operator can select the input device and see which device is in use. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-004 | P0 | The UI shows a live input level indicator and warns about silence/clipping/very low signal. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-005 | P0 | Recording is captured in short chunks; the browser must never be required to hold an entire multi-hour recording in memory. | ADR-0008, AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-006 | P0 | Chunks are uploaded incrementally during the session, with per-chunk retry and backoff. | docs/media/CHUNK-PROTOCOL.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-007 | P0 | Chunk upload is idempotent: uploading the same chunk twice must not corrupt or duplicate audio. | docs/media/CHUNK-PROTOCOL.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-008 | P0 | A session can be recovered after a browser refresh, tab close or crash, with an explicit statement of what was and was not recovered. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-009 | P0 | Raw uploaded audio is assembled server-side into a single continuous asset once the session is completed. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-010 | P1 | Assembled audio is processed (normalised loudness, canonical container) into a published-quality derivative. | docs/media/AUDIO-QUALITY.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-011 | P1 | Audio assets are stored privately; playback access is authorised per event policy, never by guessed URL. | SECURITY.md | T-AUDIO-008 | SPEC |
| FR-AUDIO-012 | P1 | A transcription derivative (16 kHz mono) is produced separately and never replaces the archive master. | docs/media/AUDIO-PIPELINE.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-013 | P1 | The event's recording policy is displayed to organizers before recording and is stored on the recording session. | docs/product/CONTENT-INTEGRITY.md | T-AUDIO-002 | SPEC |
| FR-AUDIO-014 | P1 | An operator can attach a note/annotation to the session (e.g. "microphone moved at minute 40"). | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-015 | P2 | Multiple concurrent sessions (phone + laptop) for the same event are permitted as separate assets, never merged silently. | AUDIO.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-016 | P1 | Failed or abandoned sessions are clearly marked, and their partial audio is either recoverable or explicitly deleted per retention. | RETENTION.md | T-AUDIO-001…T-AUDIO-016 | SPEC |
| FR-AUDIO-017 | P2 | A speaker/organizer can download the archive master for their own records. | CONTENT.md | T-AUDIO-001…T-AUDIO-016 | SPEC |

### FR-TRANSCRIPT

Documents: TRANSCRIPTION.md · docs/transcription/{PIPELINE,REVIEW-WORKFLOW,CODE-SWITCHING}.md · ADR-0011/0012/0023 · Tasks: T-TRANSCRIPT-001…T-TRANSCRIPT-016 · Tests: unit (no-autocorrect) · integration (**C6/C9**) · browser/editor

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-TRANSCRIPT-001 | P0 | An authorized organizer can request transcription for a completed audio asset. | TRANSCRIPTION.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-002 | P0 | Transcription runs asynchronously; the UI shows a truthful status with progress indication and never blocks other work. | TRANSCRIPTION.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-003 | P0 | The transcription provider is behind a port; no provider-specific type appears in the domain or API contracts. | ADR-0011 | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-004 | P1 | The transcription request can declare expected language(s), including a code-switching hint set (Bahasa Indonesia, Arabic, English, local languages). | docs/transcription/CODE-SWITCHING.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-005 | P1 | Raw transcript output preserves segment timestamps suitable for audio navigation. | TRANSCRIPTION.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-006 | P0 | A machine transcript enters `REVIEW_REQUIRED`; it can never become `PUBLISHED` without an explicit human approval by an authorized reviewer. | ADR-0012 | T-TRANSCRIPT-012 | SPEC |
| FR-TRANSCRIPT-007 | P1 | Reviewers can edit text, split/merge segments, adjust timestamps and correct Arabic/Islamic terminology. | docs/transcription/REVIEW-WORKFLOW.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-008 | P1 | Reviewers can mark a segment or span as uncertain/unverified, and that marking survives into the published artefact's metadata. | docs/product/CONTENT-INTEGRITY.md | T-TRANSCRIPT-014 | SPEC |
| FR-TRANSCRIPT-009 | P0 | Every save in review produces an immutable `TranscriptRevision` with author and timestamp. | DATA_MODEL.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-010 | P0 | The system distinguishes machine output from human-reviewed text in storage, API and UI (`source: MACHINE \ | ). |  | T-TRANSCRIPT-012 | SPEC |
| FR-TRANSCRIPT-011 | P1 | An approved transcript can be published to the archive only if the event's transcription policy allows publication. | docs/product/CONTENT-INTEGRITY.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-012 | P1 | Published transcripts can be unpublished (with a reason) while the revision history is preserved. | CONTENT.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-013 | P1 | A published transcript is searchable and navigable by timestamp. | CONTENT.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-014 | P2 | Transcript export (plain text, SRT/VTT, and a citation-friendly format) is available to authorized roles. | CONTENT.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-015 | P1 | Reviewer identity is recorded and visible to organizers and the speaker for published content. | FR-AUDIT-003 | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |
| FR-TRANSCRIPT-016 | P2 | A reviewer can flag a passage for the speaker's attention instead of guessing (e.g. an unclear hadith attribution). | docs/transcription/REVIEW-WORKFLOW.md | T-TRANSCRIPT-001…T-TRANSCRIPT-016 | SPEC |

### FR-CONTENT

Documents: CONTENT.md · docs/product/CONTENT-INTEGRITY.md · Tasks: T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 · Tests: integration/public projection · e2e archive browse

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-CONTENT-001 | P0 | A completed event with published media exposes a public page with title, speaker, mosque, date, topics, audio player and transcript. | CONTENT.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | SPEC |
| FR-CONTENT-002 | P1 | Content can carry timestamp chapters ("menit 12: adab menuntut ilmu"). | CONTENT.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | SPEC |
| FR-CONTENT-003 | P1 | Organizers/speakers can attach reference materials (kitab name, article links, slide/PDF) to the event. | CONTENT.md | T-CONTENT-003 | SPEC |
| FR-CONTENT-004 | P1 | Content is searchable by text across titles, topics, speaker names and approved transcripts, respecting visibility rules. | CONTENT.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | SPEC |
| FR-CONTENT-005 | P2 | Any AI-generated summary must be labelled as generated and must not be publishable without review; it never replaces the transcript. | docs/product/CONTENT-INTEGRITY.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | SPEC |
| FR-CONTENT-006 | P1 | Any published content can be unpublished by a moderator with a recorded reason and a notification to the owner. | CONTENT.md | T-CONTENT-001…T-CONTENT-007, T-TRANSCRIPT-011/013 | SPEC |
| FR-CONTENT-007 | P1 | An event marked `RECORDING_POLICY: INTERNAL` never exposes audio or transcript publicly, and the UI states this. | docs/product/CONTENT-INTEGRITY.md | T-CONTENT-003, T-AUDIO-008, T-TRANSCRIPT-012 | SPEC |

### FR-FEEDBACK

Documents: FEEDBACK.md · ADR-0016 · Tasks: T-FEEDBACK-001…T-FEEDBACK-008 · Tests: unit (aggregate/suppression) · integration (anonymity constraint) · browser

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-FEEDBACK-001 | P0 | A participant can submit feedback for an event they attended or registered for. | FEEDBACK.md | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |
| FR-FEEDBACK-002 | P1 | Feedback collects a small set of operational ratings (registration experience, venue, sound quality, topic relevance, organization, overall) plus opt… | FEEDBACK.md | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |
| FR-FEEDBACK-003 | P1 | Feedback can be submitted anonymously; anonymity must be enforced at the data layer (no participant link stored for anonymous submissions). | ADR-0016 | T-FEEDBACK-004 | SPEC |
| FR-FEEDBACK-004 | P1 | Free-text feedback is visible to organizers; speakers see aggregate ratings and a filtered set of comments of operational relevance. | FEEDBACK.md | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |
| FR-FEEDBACK-005 | P0 | Feedback must never produce a public ranking, score or comparison of speakers. | FR-SPEAKER-007 | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |
| FR-FEEDBACK-006 | P1 | Feedback containing abuse, or targeting a person rather than operations, can be reported and hidden without deleting the audit trail. | CONTENT.md | T-FEEDBACK-006 | SPEC |
| FR-FEEDBACK-007 | P1 | A feedback request is sent only to people plausibly present (checked-in or registered for the event), never to the general public. | NOTIFICATIONS.md | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |
| FR-FEEDBACK-008 | P1 | Feedback is retained in aggregated/anonimised form after the raw retention window expires. | RETENTION.md | T-FEEDBACK-001…T-FEEDBACK-008 | SPEC |

### FR-NOTIF

Documents: NOTIFICATIONS.md · Tasks: T-NOTIF-001…T-NOTIF-009 · Tests: unit (template guard) · integration (**C10**, channel policy)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-NOTIF-001 | P1 | A registrant receives a confirmation containing the event details and the check-in code/QR. | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-002 | P1 | A registrant receives a reminder before the event, at a configurable lead time. | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-003 | P1 | Participants are notified of cancellations and location/venue changes with the reason. | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-004 | P1 | Participants can be notified when a recording or a reviewed transcript becomes available. | CONTENT.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-005 | P1 | A feedback request is sent only after the event, once, with a limit on repeats. | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-006 | P1 | Notification delivery is asynchronous via an outbox; failures are retried and visible to operators. | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-007 | P1 | Channels: in-app (default) and email. WhatsApp/SMS/Telegram are optional adapters added post-MVP. | docs/research/STACK-2026.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-008 | P1 | Users can opt out of non-essential notifications (reminders stay optional, operational messages like cancellation remain). | PRIVACY.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-009 | P2 | A mosque/organization can broadcast an announcement to its program's participants (opt-in, rate-limited). | NOTIFICATIONS.md | T-NOTIF-001…T-NOTIF-009 | SPEC |
| FR-NOTIF-010 | P1 | Notifications never contain QR tokens or other secrets in plain text in a channel that cannot be access-controlled. | SECURITY.md | T-NOTIF-004 | SPEC |

### FR-ANALYTICS

Documents: docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 · Tasks: T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 · Tests: integration (audit chain, moderation SoD) · unit

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-ANALYTICS-001 | P1 | An organizer dashboard shows: upcoming kajian, registration count, capacity, checked-in count, attendance rate, recording status, transcription statu… | OBSERVABILITY.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-ANALYTICS-002 | P1 | Actionable operational alerts are raised for defined conditions and are deduplicated. | OBSERVABILITY.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-ANALYTICS-003 | P2 | Funnel metrics (view → register → check-in) are available per event without identifying individuals. | PRIVACY.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-ANALYTICS-004 | P0 | No third-party advertising or behavioural tracking script is permitted in participant-facing pages. | NFR-PRIV-008 | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |

### FR-MOD

Documents: docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 · Tasks: T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 · Tests: integration (audit chain, moderation SoD) · unit

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-MOD-001 | P1 | Any user can report published content; reports are queued for moderators. | CONTENT.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-MOD-002 | P1 | A moderator can unpublish content, request changes, and record an outcome with a reason. | CONTENT.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-MOD-003 | P1 | A moderator can suspend a speaker profile's public visibility pending verification, without deleting historical records. | docs/product/SPEAKERS.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-MOD-004 | P1 | Moderation decisions are audited and appealable by the content owner. | FR-AUDIT-002 | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |

### FR-AUDIT

Documents: docs/design/PAGES.md · SECURITY.md §9 · OBSERVABILITY.md §8 · Tasks: T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 · Tests: integration (audit chain, moderation SoD) · unit

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| FR-AUDIT-001 | P0 | Security- and integrity-relevant actions append immutable audit events. | AUDIT, SECURITY.md | T-SEC-007 | SPEC |
| FR-AUDIT-002 | P1 | Platform/admin actions (verification, moderation, role changes) are audited with actor, target, reason. | SECURITY.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-AUDIT-003 | P1 | Attendance corrections, token re-issues and transcript approvals are audited with actor and reason. | ATTENDANCE.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-AUDIT-004 | P1 | Authorized administrators can query audit events by actor, target, type and time range, with results exportable. | SECURITY.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |
| FR-AUDIT-005 | P2 | Audit events support a retention that outlives the data they describe (see `RETENTION.md`). | RETENTION.md | T-ANALYTICS-001…T-ANALYTICS-004, T-MOD-001…T-MOD-004, T-AUDIT-001/002, T-SEC-007 | SPEC |

---

## 3. Non-functional requirements

### NFR-SEC

Documents: SECURITY.md · THREAT_MODEL.md · docs/security/{AUTHZ-MATRIX,QR-SECURITY,INCIDENT-RESPONSE}.md · Tasks: T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 · Tests: integration/security (isolation, tokens, upload abuse, permission matrix) · unit/lint

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-SEC-001 | P0 | Every mutating API requires an authenticated principal unless it is an explicitly public operation (registration for an `OPEN` event). | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | IMPL (partial — identity, sessions, the durable limiter and the sign-up → `getSession()` round trip are delivered by T-ORG-001; the public surfaces are enumerated in `src/server/auth/public-routes.ts`; no product route exists yet) |
| NFR-SEC-002 | P0 | Authorization is enforced **server-side** on every request, including Server Actions and route handlers; UI hiding is never a control. | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | IMPL (partial — `requirePermission` is the single server-side choke point and a static test proves no route acts without it or a listed public reason; no product route performs an action yet, so there is nothing more to enumerate) |
| NFR-SEC-003 | P0 | Organization isolation is enforced on every scoped query; no endpoint accepts an unscoped id without an ownership check. | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | IMPL (partial — every scoped repository requires a `TenantScope` and RLS is the proved second layer; enforcement across *every* endpoint arrives as endpoints are built) |
| NFR-SEC-004 | P0 | Check-in tokens are opaque, high-entropy (≥128 bits), stored hashed, and compared in constant time. | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | SPEC |
| NFR-SEC-005 | P0 | QR payloads contain no PII and no raw database identifiers. | — | T-CHECKIN-003 | SPEC |
| NFR-SEC-006 | P0 | All state-changing requests require CSRF protection (SameSite cookies + origin checks) and safe methods are idempotent. | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | SPEC |
| NFR-SEC-007 | P0 | All user-generated content is escaped/output-encoded; stored HTML is not permitted (Markdown subset only). | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | SPEC |
| NFR-SEC-008 | P0 | All database access uses parameterised queries; raw string concatenation into SQL is forbidden. | — | T-SEC-001…T-SEC-011, T-OBS-002, T-CHECKIN-003/011/016, T-AUDIO-004 | SPEC |
| NFR-SEC-009 | P0 | File/audio uploads are size-limited, content-type-verified by sniffing, and never executed or served from the app origin as active content. | — | T-SEC-005 | SPEC |
| NFR-SEC-010 | P0 | Rate limits exist on registration, check-in, token validation, upload and auth endpoints; limits are durable across restarts. | — | T-REG-009 | IMPL (partial — durable Postgres buckets with an atomic check-and-increment, shared by replicas and surviving restarts; registration/check-in/upload limits and the rejection metric arrive with their slices, T-SEC-010) |
| NFR-SEC-011 | P0 | Secrets are supplied via environment/secret manager, never committed, and rotated by procedure (`OPERATIONS.md`). | — | T-SEC-008 | SPEC |
| NFR-SEC-012 | P1 | A security advisory intake and patch SLA exists (critical ≤ 72h) and dependency review runs monthly. | — | T-SEC-011 | SPEC |

### NFR-PRIV

Documents: PRIVACY.md · RETENTION.md · ADR-0016/0017 · Tasks: T-PRIV-001…T-PRIV-003, T-REG-011, T-ATTEND-006, T-FEEDBACK-004, T-SEC-004, T-OPS-006 · Tests: integration (constraints, retention, exports) · unit (telemetry allow-list)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-PRIV-001 | P0 | Data minimisation: no field may be collected without a stated purpose in `PRIVACY.md` §Data inventory. | — | T-PRIV-001…T-PRIV-003, T-REG-011, T-ATTEND-006, T-FEEDBACK-004, T-SEC-004, T-OPS-006 | SPEC |
| NFR-PRIV-002 | P0 | A participant may request access to and deletion of their personal data; deletion propagates per `RETENTION.md`. | — | T-PRIV-001, T-OPS-006 | SPEC |
| NFR-PRIV-003 | P0 | Recording and publication policy is explicit per event and shown before recording starts. | — | T-PRIV-001…T-PRIV-003, T-REG-011, T-ATTEND-006, T-FEEDBACK-004, T-SEC-004, T-OPS-006 | SPEC |
| NFR-PRIV-004 | P0 | Voice recordings are personal data: processed under a stated lawful basis, private by default. | — | T-PRIV-001 | SPEC |
| NFR-PRIV-005 | P0 | Analytics are aggregate; no individual participant behaviour profile is built or exported. | — | T-FEEDBACK-004 | SPEC |
| NFR-PRIV-006 | P0 | Logs and telemetry never contain raw audio, transcript content, contact details or tokens. | — | T-OBS-002, T-SEC-004 | SPEC |
| NFR-PRIV-007 | P1 | Third-party processors (hosted STT, email, hosting) are documented with data categories, region and purpose; no voice data leaves the boundary withou… | — | T-TRANSCRIPT-005 | SPEC |
| NFR-PRIV-008 | P0 | Participant data is never sold, shared or used for advertising. | — | T-PRIV-001…T-PRIV-003, T-REG-011, T-ATTEND-006, T-FEEDBACK-004, T-SEC-004, T-OPS-006 | SPEC |
| NFR-PRIV-009 | P1 | Any breach triggers the documented 72-hour notification procedure (UU PDP). | — | T-SEC-011, T-PRIV-002 | SPEC |

### NFR-PERF

Documents: PERFORMANCE.md (P1–P40) · docs/operations/SLO.md · Tasks: T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 · Tests: e2e/load (budgets) · integration (query plans)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-PERF-001 | P0 | Event discovery list is server-rendered and interactive within 2.5 s on a mid-range Android phone on 3G Fast (see `PERFORMANCE.md` for the full budge… | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-002 | P0 | QR token validation p95 ≤ 300 ms server-side, excluding network. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-003 | P0 | A check-in is complete (scan → visible confirmation) in ≤ 1 s p95 on a 4G connection and ≤ 2.5 s p95 on 3G. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-004 | P0 | The check-in screen sustains ≥ 20 check-ins/minute from a single device; the server sustains ≥ 200 scans/minute per event with p95 ≤ 300 ms. | — | T-PERF-002, T-OPS-004 | SPEC |
| NFR-PERF-005 | P0 | Audio chunk upload of 10 s of Opus completes within the chunk interval on 3G; upload backlog must never grow unbounded during a session. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-006 | P0 | Organizer dashboard first contentful paint ≤ 2 s on desktop broadband with warm cache. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-007 | P1 | Registration submission p95 ≤ 800 ms. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-008 | P1 | Published transcript page loads its first screenful ≤ 1.5 s and streams the rest. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-009 | P1 | Search returns results p95 ≤ 700 ms for the first page. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |
| NFR-PERF-010 | P1 | Recording start (press → capturing) ≤ 1.5 s after permission is granted. | — | T-PERF-001, T-PERF-002, T-PERF-003, T-CHECKIN-002, T-REG-012 | SPEC |

### NFR-REL

Documents: docs/architecture/{FAILURE-MODEL,CONCURRENCY}.md · Tasks: T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 · Tests: integration (jobs, **C11**) · e2e drills · chaos steps

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-REL-001 | P0 | A 2-hour recording survives: browser refresh, tab close and reopen, network loss up to 30 minutes, and one process restart, without losing more than… | — | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | SPEC |
| NFR-REL-002 | P0 | Check-in never reports success for attendance that was not committed. | — | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | SPEC |
| NFR-REL-003 | P0 | Duplicate submissions of the same mutation converge to one record (idempotency), verified by concurrency tests. | — | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | SPEC |
| NFR-REL-004 | P1 | Background jobs are retried with backoff, dead-lettered on exhaustion, and never silently dropped. | — | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | SPEC |
| NFR-REL-005 | P1 | Object storage failures degrade recording to local buffering with an explicit, visible warning rather than silent loss. | — | T-AUDIO-009…T-AUDIO-013, T-ATTEND-007, T-PERF-002, T-OPS-004, T-NOTIF-008 | SPEC |
| NFR-REL-006 | P1 | Managed availability target: 99.5% monthly for participant-facing read paths; check-in has a documented degraded mode. | — | T-OPS-004 | SPEC |

### NFR-A11Y

Documents: ACCESSIBILITY.md · docs/design/DESIGN-SYSTEM.md · Tasks: T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 · Tests: e2e/a11y (axe + keyboard script) · browser/component

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-A11Y-001 | P0 | WCAG 2.2 AA conformance for participant-, volunteer- and reviewer-facing screens. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-002 | P0 | Minimum touch target 44×44 CSS px; primary check-in feedback is perceivable without colour and at ≥ 1 m distance. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-003 | P0 | QR is never the only check-in mechanism; a manual code/name fallback always exists. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-004 | P0 | All flows are fully keyboard-operable, including the scanner's manual fallback and the recorder controls. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-005 | P0 | Body text ≥ 16 px, contrast ≥ 4.5:1, no text in images, no reliance on hover. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-006 | P1 | Screen-reader announcements for check-in results and recording state changes (live regions), without leaking PII. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-007 | P1 | Published audio has a transcript (or an explicit "transcript not available" statement) and transcripts are semantically structured for assistive tech. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |
| NFR-A11Y-008 | P1 | Supported and tested at 200% zoom and with OS font scaling, on 360 px-wide screens. | — | T-CHECKIN-002, T-CHECKIN-004, T-CHECKIN-010, T-CONTENT-007, T-AUDIO-016, T-FEEDBACK-001 | SPEC |

### NFR-OBS

Documents: OBSERVABILITY.md · docs/operations/SLO.md · Tasks: T-OBS-001, T-OBS-002, T-OBS-003 · Tests: unit/observability · integration/tracing · ops verification

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-OBS-001 | P0 | Every request carries a correlation id propagated through logs, traces and job payloads. | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-002 | P0 | Structured JSON logs with allow-listed attributes; no PII, audio or transcript content. | — | T-OBS-002 | SPEC |
| NFR-OBS-003 | P0 | Metrics exist for registration outcomes, check-in outcomes/duplicates, upload failures, recording interruptions, transcription duration/failures, sto… | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-004 | P0 | OpenTelemetry traces (OTLP) instrument HTTP handlers, jobs and storage operations; vendor-neutral. | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-005 | P1 | Organizer-visible alerts are distinct from operator-visible alerts and are deduplicated (`OPERATIONAL_ALERTS`). | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-006 | P1 | Each SLO in `docs/operations/SLO.md` has a dashboard panel and an alert. | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-007 | P1 | Log retention and access are defined and private (log content is still personal data when it contains identifiers). | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |
| NFR-OBS-008 | P2 | Recording session telemetry includes chunk gaps and upload backlog as first-class quality signals. | — | T-OBS-001, T-OBS-002, T-OBS-003 | SPEC |

### NFR-MOB

Documents: PERFORMANCE.md §budgets · docs/design/DESIGN-SYSTEM.md · Tasks: T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 · Tests: browser/component · e2e on throttled network

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-MOB-001 | P0 | All participant and volunteer flows work in Chrome/Android, Safari/iOS 17+, and Firefox current, at 360 px width. | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |
| NFR-MOB-002 | P0 | Camera and microphone usage is user-initiated, with explicit purposes and graceful denial handling. | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |
| NFR-MOB-003 | P0 | Core participant flows work on a 3G-class connection with < 1 MB initial JS for participant pages. | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |
| NFR-MOB-004 | P1 | The participant's check-in code is reachable offline (cached page/screenshot guidance, downloadable QR) — the *client* does not need the network to *… | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |
| NFR-MOB-005 | P1 | PWA installability with offline shell for "my registration" and check-in code display. | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |
| NFR-MOB-006 | P1 | No dependence on exotic device features; no requirement for gyroscope/NFC/Bluetooth. | — | T-REG-012, T-AUDIO-006, T-AUDIO-013, T-CHECKIN-002, T-AUDIO-016 | SPEC |

### NFR-I18N

Documents: ACCESSIBILITY.md §language · docs/transcription/CODE-SWITCHING.md · Tasks: T-TRANSCRIPT-004, T-CONTENT-007 · Tests: browser (bidi, Arabic rendering) · unit (tagging)

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-I18N-001 | P0 | User-facing copy is Bahasa Indonesia by default with an English locale available. | — | T-TRANSCRIPT-004, T-CONTENT-007 | SPEC |
| NFR-I18N-002 | P0 | Dates/times render in the venue timezone with locale-aware formatting and no ambiguous numeric dates. | — | T-TRANSCRIPT-004, T-CONTENT-007 | SPEC |
| NFR-I18N-003 | P1 | Text input supports Arabic script throughout (no ASCII-only validation, correct bidi rendering in the transcript editor). | — | T-TRANSCRIPT-004, T-CONTENT-007 | SPEC |
| NFR-I18N-004 | P1 | Prayer-relative times may be displayed without conversion; conversion requires a configured prayer-time source. | — | T-TRANSCRIPT-004, T-CONTENT-007 | SPEC |

### NFR-OPS

Documents: DEPLOYMENT.md · OPERATIONS.md · docs/operations/{SLO,BACKUP-RESTORE}.md · Tasks: T-OPS-001…T-OPS-006, T-DOCS-001 · Tests: integration/ops (smoke, restore safety) · drills

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-OPS-001 | P0 | Single-command local development (compose: Postgres + storage + collector). | — | T-OPS-001…T-OPS-006, T-DOCS-001 | IMPL (partial — the verification commands all run and are green on Node 24: `typecheck`, `lint` with the project's own boundary and no-fake rules, `test`, `docs:lint` with 0 findings and `build`; the compose stack itself is `T-OPS-001`) |
| NFR-OPS-002 | P0 | Production topology is documented, reproducible from the repository, and restorable from backup (`docs/operations/BACKUP-RESTORE.md`). | — | T-OPS-006 | SPEC |
| NFR-OPS-003 | P0 | Rollback is possible within 10 minutes for the web tier and the worker. | — | T-OPS-001…T-OPS-006, T-DOCS-001 | SPEC |
| NFR-OPS-004 | P1 | All configuration is environment-driven and validated at boot with a fail-fast check. | — | T-OPS-001…T-OPS-006, T-DOCS-001 | SPEC |
| NFR-OPS-005 | P1 | A single operator can run the platform for ≤ 500 events/month with no routine manual intervention. | — | T-OPS-001…T-OPS-006, T-DOCS-001 | SPEC |
| NFR-OPS-006 | P2 | Cost per event is documented and predictable; no per-seat or per-scan licensing. | — | T-OPS-001…T-OPS-006, T-DOCS-001 | SPEC |

### NFR-ETH

Documents: docs/product/CONTENT-INTEGRITY.md · ADR-0012/0014/0023/0024 · Tasks: T-SPEAKER-004, T-TRANSCRIPT-014, T-FEEDBACK-006, T-CHECKIN-018 · Tests: unit (guard tests) · integration (gate) · review

| ID | Pri | Requirement (abbreviated) | PRD doc ref | Owning task(s) | Status |
|---|---|---|---|---|---|
| NFR-ETH-001 | P0 | No ranking/popularity/authority scoring of speakers anywhere in data, API, UI or exports. | — | T-SPEAKER-004, T-TRANSCRIPT-014, T-FEEDBACK-006, T-CHECKIN-018 | SPEC |
| NFR-ETH-002 | P0 | Machine-generated religious text is never presented as reviewed or authoritative. | — | T-TRANSCRIPT-014 | SPEC |
| NFR-ETH-003 | P0 | Content ownership and publication authority rest with the speaker/organizer, not the platform. | — | T-SPEAKER-004, T-TRANSCRIPT-014, T-FEEDBACK-006, T-CHECKIN-018 | SPEC |
| NFR-ETH-004 | P1 | Organizers cannot be nudged toward engagement-maximising behaviour (no streaks, no prompts to "boost" reach). | — | T-SPEAKER-004, T-TRANSCRIPT-014, T-FEEDBACK-006, T-CHECKIN-018 | SPEC |

---

## 4. Requirement → roadmap slice

| Slice | Requirements delivered |
|---|---|
| VS-1 | FR-ORG-001…006, FR-MOSQUE-001…009, FR-SPEAKER-001…008 |
| VS-2 | FR-PROGRAM-001…007, FR-EVENT-001…017 |
| VS-3 | FR-REG-001…014 |
| VS-4 | FR-CHECKIN-001…016 |
| VS-5 | FR-ATTEND-001…008 |
| VS-6 | FR-ANALYTICS-001/002, FR-AUDIT-003/004 |
| VS-7 | FR-AUDIO-001…009, 013…017 |
| VS-8 | FR-AUDIO-010…012, 014 |
| VS-9 | FR-TRANSCRIPT-001…005 |
| VS-10 | FR-TRANSCRIPT-006…016, FR-CONTENT-001…007, FR-MOD-001…004 |
| VS-11 | FR-FEEDBACK-001…008 |
| VS-12 | FR-NOTIF-001…010 |
| VS-13 | NFR-SEC-*, NFR-PRIV-*, FR-AUDIT-001/002/005 |
| VS-14 | NFR-OBS-*, FR-ANALYTICS-004 |
| VS-15 | NFR-OPS-*, NFR-REL-* (operational verification) |

Cross-cutting from VS-1 onward: NFR-PERF-*, NFR-A11Y-*, NFR-MOB-*, NFR-I18N-*, NFR-ETH-* — these
are verified per slice, not deferred to the end.

## 5. Mocking and test-layer policy

Each requirement's tests must use the layer named in §2/§3 and follow `TESTING.md` §2:

- **unit/domain** — pure rules, no I/O, fixed clock (state machines, recurrence maths, token grammar).
- **unit/application** — services with fake ports (behaviour, error mapping, idempotency decisions).
- **integration** — real PostgreSQL (and MinIO) for constraints, transactions, jobs, RLS, audit chain.
- **browser** — components with real DOM (scanner states, recorder states, editor, bidi/Arabic).
- **e2e** — Playwright against a composed stack (discovery→attendance, recording survival, publish gate).
- **load** — budgets from `PERFORMANCE.md` (check-in throughput, registration contention, upload concurrency).
- **a11y** — axe + the keyboard script on P0 flows.

No requirement may be verified only by a mock of the thing it constrains: attendance integrity, the
publication gate, tenancy and token storage must be proven against the database.

## 6. Interface and contract obligations

Every requirement that adds or changes an interface must be reflected, in the same change, in:

1. `API.md` — endpoint or Server Action, permissions, idempotency, error codes.
2. `src/shared/contracts/**` — request/response DTOs and validation schemas (skeletons are real types).
3. `EVENTS.md` + `src/shared/contracts/events.ts` — any domain event (ids, counts, enums only).
4. `STATE_MACHINE.md` + `src/domain/<entity>/*.transitions.ts` — any state change.
5. `DATA_MODEL.md` §11 — any new invariant or constraint.
6. `docs/security/AUTHZ-MATRIX.md` — any new action or scope.
7. `NOTIFICATIONS.md` — any new participant-facing message (with a dedupe key).

## 7. Known gaps and honest limitations (as of Phase 0)

1. **Task granularity.** Part B tasks exist as compact inventory rows; requirement-level task mapping
   below the family level is precise only where another document already cited a task (see the
   overrides applied in §2/§3). Expanding each row into a full sixteen-field block is required before
   its slice starts (`AGENTS.md` §9).
2. **Test files do not exist yet.** Test layers are named; the concrete test files are Phase-0
   skeletons with `describe.todo()` titles and must be implemented with their task.
3. **Status is uniform.** Every requirement is `SPEC`: no implementation exists anywhere in `src/**`
   beyond contracts, ports and route shells. Do not read `SPEC` as progress.
4. **Deferred items are visible in the PRD**: some requirements carry a deferral note (e.g.
   FR-CHECKIN-013 token rotation is scheduled to VS-4.5). Those keep their IDs and their mapping.
5. **No requirement is untraceable**: every row has a document reference from the PRD; the doc
   reference column above is parsed from the PRD, so a missing reference would show as an em dash.

## 8. Maintenance rules

1. A PR that adds a requirement adds a row here **and** in `PRD.md` in the same change.
2. A PR that implements something updates the status column from `SPEC` to `SKELETON`/`IMPL` and
   records the task ID and date.
3. A PR that renames a requirement ID is rejected (IDs are permanent; supersede instead).
4. The docs lint task (`T-DOCS-001`) verifies mechanically: every ID referenced in any document
   exists in `PRD.md`, and every ID in `PRD.md` appears in this file.
5. Precision improves over time: when a slice starts, replace family-level task references with the
   exact tasks, and keep the mapping honest rather than tidy.
