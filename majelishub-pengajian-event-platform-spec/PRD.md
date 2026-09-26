# PRD — MajelisHub

**Product Requirements Document**

- Version: 1.0 (Phase 0 baseline) · Date: 2026-09-26 · Status: **Authoritative**
- Authority: this document is the root of the hierarchy in `README.md`. Lower documents may
  refine but never contradict it.
- Requirement IDs are **stable** and permanent. IDs are never renumbered or reused; a
  withdrawn requirement is marked `WITHDRAWN` with a pointer to its replacement.

---

## 1. Product problem

Kajian (Islamic learning events) are organised constantly across Indonesia — in mosques,
musholla, surau, offices, campuses and community halls. Coordination today is manual and
fragmented:

1. **Discovery is word-of-mouth.** A poster image on WhatsApp, a photo of a printed flyer,
   a forwarded message. There is no reliable answer to "kajian apa yang tersedia di dekat
   saya?" and no way to see it in one place.
2. **Attendee counts are guesses.** Organizers plan food, seating and parking from a
   show-of-hands estimate or a WhatsApp poll that overstates and undercounts in equal
   measure.
3. **Entrance handling is a bottleneck.** A queue of hundreds at a mosque gate with no
   fast way to know who has arrived; paper attendance is slow, lossy and creates a pile of
   personal data nobody secures.
4. **The teaching is lost.** A valuable 2-hour kajian exists once, then vanishes. If it is
   recorded at all, it is an unlabelled file on a phone that cannot be found a month later.
5. **Transcription is a "someday" task.** Automatic transcription is now cheap, but it is
   unreliable exactly where this domain is hardest — Arabic terms, Qur'anic verses, hadith,
   names, Indonesian–Arabic code-switching — and it is *dangerous* if published unchecked
   in religious content.
6. **Feedback never arrives.** Organizers operate blind on sound quality, venue problems and
   topic relevance.
7. **Follow-up is ad hoc.** Participants who miss a session have no path to the recording or
   to the next session in the same program.

**Root cause:** there is no shared, low-friction system of record for the kajian lifecycle
that a volunteer can reasonably operate.

## 2. Product vision

> Make a kajian easy to find, easy to attend, and durable afterwards — for organisers who
> have no IT department, and for participants who have never installed the app before this
> morning.

**Positioning statement.** For mosque administrators, kajian organizers and communities who
run regular religious learning sessions, MajelisHub is a coordination platform that carries
one event from discovery through attendance to a reviewed, searchable recording — unlike
generic event platforms (built around tickets and promotion), chat groups (no record, no
structure, no archive), or single-mosque apps (cannot federate across many mosques).

**Product personality:** simple, respectful, calm, mobile-first, fast at the mosque
entrance, accessible, low friction, information-first (`DESIGN.md`).

## 3. Target users

| Segment | Size/shape | Primary need |
|---|---|---|
| **Mosque administrators** | 1–500 mosques per deployment; often one volunteer with a phone | Run schedules and let people attend without adding admin work |
| **Kajian organizers / communities** | 1–20 active people; may not be mosque-affiliated | Publish programs across venues, measure real attendance, publish recordings |
| **Ustadz / speakers** | Independent; may appear at many mosques | Be discoverable and correctly represented; own their content; see aggregate feedback |
| **Participants / jamaah** | Hundreds to thousands per mosque, wide age range | Know what's on, attend without friction, find the recording later |
| **Entrance volunteers** | Rotating, untrained, using their own phones | Scan people in fast, with obvious success/failure |
| **Audio operators** | 0–2 per mosque | Start a reliable recording of a 2-hour session without fear of losing it |
| **Transcript reviewers** | Often the ustadz or a trusted student | Fix transcription errors responsibly, without publishing machine output |
| **Platform administrators** | The product operator | Verify speakers, moderate content, keep the platform trustworthy |

**Non-users / explicitly not served in MVP:** advertisers, donation collectors, ticketing
resellers, "influencer" speakers seeking audience metrics.

## 4. Personas

### P1 — Bu Sariah, 61, participant (Padang)
Prayer-focused, uses a mid-range Android phone, WhatsApp only. Attends the weekly ba'da
Subuh kajian. **Needs:** a reminder in plain language, a QR she can show from the lock
screen, no small text, no English, no 20-field form. **Fears:** being embarrassed at the
entrance because the app is confusing; her phone number being shared.
**Success:** she is checked in within 5 seconds of showing her screen.

### P2 — Ustadz Rahman, 38, speaker
Speaks at 4 mosques, has 6,000 followers on a messaging channel he finds exhausting.
**Needs:** one canonical profile he can send people to; past kajian with recordings and
reviewed transcripts; his own approval before publication of his words.
**Fears:** being misquoted; a machine transcript of Qur'anic text published with errors.
**Success:** he reviews a transcript on his phone and approves it with corrections intact.

### P3 — Pak Andi, 45, mosque administrator + organizer (also the audio operator)
Volunteer, has a day job. **Needs:** create a monthly program once, get events
automatically; know how many came; a recording he cannot lose. **Fears:** the internet dying
mid-recording; being blamed for lost data; monthly costs he must explain to the committee.
**Success:** a 2-hour recording survives a Wi-Fi drop and a browser crash.

### P4 — Rizka, 22, entrance volunteer
Arrives 15 minutes before the kajian, has never used MajelisHub. **Needs:** open the check-in
screen, point the camera, hear/see success, repeat. **Fears:** causing a queue; checking the
same person in twice; her own phone number being shown on screen.
**Success:** she is scanning within 60 seconds of being handed the phone, without training.

### P5 — Nur, 30, transcript reviewer
Graduate student in Islamic studies, part-time. **Needs:** audio playback tied to text,
uncertainty marking, comfortable Arabic editing on a laptop, nothing published by accident.
**Fears:** introducing an error into a Qur'anic quotation; losing an hour of editing.
**Success:** she can review 1 hour of audio in under 90 minutes and be confident about what
she published.

### P6 — Ayu, 26, platform administrator
**Needs:** verify speaker claims, handle content reports, see whether the platform is broken.
**Fears:** approving a false religious authority claim; unmoderated harmful content.
**Success:** every report decided within 48 hours, with an audit trail.

## 5. Jobs to be done

| JTBD | When … | I want to … | So I can … |
|---|---|---|---|
| JTBD-1 Discover | I have free time and want to learn | see kajian near me, filtered by time and topic | choose one without asking anyone |
| JTBD-2 Evaluate | I found a kajian | see who is speaking, where, when, and what it's about | decide whether it fits me |
| JTBD-3 Register | I decided to attend | sign up in under a minute with minimal data | reserve a place and get a reminder |
| JTBD-4 Attend | I arrive at the mosque | be admitted fast without paperwork | not hold up the queue |
| JTBD-5 Verify attendance (organizer) | the event starts | know how many came and who | plan seating, food and reporting |
| JTBD-6 Record | the session begins | capture the whole talk reliably | preserve the teaching |
| JTBD-7 Transcribe | after the session | get a text draft I can correct | make the teaching searchable without misquoting |
| JTBD-8 Review & publish | the draft exists | correct and approve it myself | publish only what I stand behind |
| JTBD-9 Revisit | weeks later | find the recording and transcript again | listen on the commute, share the reference |
| JTBD-10 Feedback | after a session | tell organisers what to fix, without public exposure | improve the next one |
| JTBD-11 Follow up | after a session | know when the next one in this program is | keep the habit |
| JTBD-12 Manage program (organizer) | running a routine | define the weekly kajian once | stop re-creating events by hand |

## 6. Scope

**In scope (Phases 1–15, see `ROADMAP.md`):** mosque/venue registry, speaker profiles,
recurring programs and events, registration with capacity/waitlist, QR check-in with manual
fallback, attendance and reporting, browser-based audio recording with resilient chunked
upload, asynchronous transcription with mandatory human review, reviewed-content archive with
search, feedback, notifications (in-app + email), moderation, audit, organizer dashboards,
observability, and hardening.

**Out of scope for the whole product (see §7):** ticketing/payments, donations, live
streaming, video-first media, native mobile apps, social graph, speaker ranking, third-party
ad tracking, cross-organization analytics, AI-generated religious content.

## 7. Non-goals

| # | Non-goal | Why (and what we do instead) |
|---|---|---|
| NG-1 | Selling tickets or taking donations | Expands legal/financial surface (PCI, amil/zakat governance) unrelated to the kajian lifecycle. Donations belong to the mosque's existing process. |
| NG-2 | Live video streaming | Bandwidth at a mosque is the constraint; a reliable recording that survives the session beats a stream that fails. |
| NG-3 | Ranking, scoring or "recommending" speakers | Religious authority is not a metric. Discovery is by mosque, program, time, topic and language only (`ADR-0024`, `NFR-ETH-001`). |
| NG-4 | A social feed with likes/followers/comments on teachings | Turns the archive into an engagement product and invites harmful theological argument in public. Feedback is private to organisers and aggregated. |
| NG-5 | Automatic publication of machine transcripts | Unacceptable risk of misquoting Qur'an and hadith. Human review is mandatory (`ADR-0012`). |
| NG-6 | AI summarisation presented as the teaching | Summaries may exist *later* and only as clearly-labelled generated aids on reviewed content (`FR-CONTENT-005`). |
| NG-7 | Native iOS/Android applications | PWA-first: the entrance workflow and the participant flow must work in a browser; a native shell adds release friction without user benefit (`ADR-0027`). |
| NG-8 | Public attendance leaderboards or streaks | Attendance is used for planning and reporting, not for competition. |
| NG-9 | Advertising or data monetisation | The data is religious and personal. Never sold, never shared for advertising (`NFR-PRIV-008`). |
| NG-10 | Becoming a fatwa/authority platform | The platform publishes what a named speaker said, with provenance; it never asserts rulings itself. |

## 8. Primary workflows

### 8.1 Participant
```
Discover Kajian → Open Event → See Ustadz + Mosque + Schedule → Register → Receive QR
→ Arrive → Scan QR → Attend → Receive Recording / Transcript → Submit Feedback
```
Documented: `DESIGN.md` §Participant, `REGISTRATION.md`, `CHECKIN.md`, `docs/design/UX-FLOWS.md`.

### 8.2 Organizer
```
Create Kajian → Choose Mosque → Choose Speaker → Define Capacity → Publish → Registration
→ QR Check-In → Attendance → Record Audio → Generate Transcript → Review → Publish
→ Review Feedback
```
Documented: `DESIGN.md` §Organizer, `docs/product/EVENTS.md`, `AUDIO.md`, `TRANSCRIPTION.md`.

### 8.3 Speaker / content
```
Profile (bio, areas of study, affiliation, verification) → Upcoming kajian → Past kajian
→ Published recordings → Reviewed transcripts → Aggregate feedback
```
Documented: `docs/product/SPEAKERS.md`, `CONTENT.md`.

### 8.4 Volunteer / entrance (high-speed)
```
Open Scanner → Participant Shows QR → Scan → Validate → Attendance Confirmed
→ Immediate Visual Feedback → (auto-resume for next person)
```
Documented: `CHECKIN.md`, `docs/attendance/*`, `QA.md` §Busy Mosque Entrance.

## 9. Functional requirements

Priorities: **P0** = required for the matching vertical slice to be useful · **P1** =
required before production launch · **P2** = valuable, deferrable · **WITHDRAWN** = dropped.

Every requirement names: the ID, the statement, and the *primary* spec document that
refines it. Acceptance criteria for P0/P1 live with the requirement; verification method is
in `docs/TRACEABILITY.md`.

### 9.1 Identity & organizations

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-ORG-001 | P0 | An organization (tenant) can be created with a name, type and default timezone; it owns all scoped data. | `ARCHITECTURE.md` §Tenancy |
| FR-ORG-002 | P0 | An organization can assign members to roles from the role catalogue; a member may hold several roles. | `docs/security/AUTHZ-MATRIX.md` |
| FR-ORG-003 | P0 | No actor can read or mutate another organization's data through any API, page or export. | `SECURITY.md` §Isolation |
| FR-ORG-004 | P1 | An organization can set defaults used when creating events (timezone, registration mode, recording policy). | `docs/product/EVENTS.md` |
| FR-ORG-005 | P1 | Roles can be scoped to a subset of mosques/venues (a volunteer responsible for one mosque only). | `docs/security/AUTHZ-MATRIX.md` |
| FR-ORG-006 | P2 | Organization-level branding (logo, colour) applied to participant-facing pages. | `docs/design/DESIGN-SYSTEM.md` |

### 9.2 Mosques, venues, locations

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-MOSQUE-001 | P0 | A mosque can be created with name, type, address, coordinates and timezone. | `docs/product/MOSQUES.md` |
| FR-MOSQUE-002 | P0 | A mosque has a public profile page listing its upcoming kajian. | `docs/product/MOSQUES.md` |
| FR-MOSQUE-003 | P0 | A mosque exposes facilities and accessibility information (parking, women's prayer area, wudu, wheelchair access, public transport, entrance instructions). | `docs/product/MOSQUES.md`, `ACCESSIBILITY.md` |
| FR-MOSQUE-004 | P1 | A mosque stores contact information with a visibility setting; contact details are never exposed publicly by default. | `PRIVACY.md` §Minimisation |
| FR-MOSQUE-005 | P0 | A mosque can contain multiple usable venues (halls/rooms) with independent capacity. | `docs/product/MOSQUES.md` |
| FR-MOSQUE-006 | P1 | A venue records capacity, floor/level, and its own entrance/access notes. | `docs/product/MOSQUES.md` |
| FR-MOSQUE-007 | P1 | A venue can define check-in instructions shown to volunteers on the check-in screen. | `CHECKIN.md` §Operations |
| FR-MOSQUE-008 | P1 | Mosque records indicate the timezone used for all event display; coordinates are used for "near me" ordering only. | `docs/product/MOSQUES.md` |
| FR-MOSQUE-009 | P2 | A mosque can be marked as temporarily closed/unavailable, blocking new events. | `docs/product/MOSQUES.md` |

### 9.3 Speakers

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-SPEAKER-001 | P0 | A speaker profile can be created with name, display name, biography, areas of study, organization/affiliation and photo. | `docs/product/SPEAKERS.md` |
| FR-SPEAKER-002 | P1 | Speaker profiles support a platform-managed verification status with a recorded verifier and evidence note. | `docs/product/SPEAKERS.md` |
| FR-SPEAKER-003 | P0 | A public speaker page lists upcoming kajian and past kajian. | `docs/product/SPEAKERS.md` |
| FR-SPEAKER-004 | P1 | A public speaker page lists published recordings and reviewed transcripts. | `CONTENT.md` |
| FR-SPEAKER-005 | P1 | A speaker can claim a profile and correct their own information; corrections are audited. | `docs/product/SPEAKERS.md` |
| FR-SPEAKER-006 | P1 | A speaker profile can be unlisted at the speaker's request without deleting past attendance records. | `PRIVACY.md` |
| FR-SPEAKER-007 | P0 | The system must not compute, display or export any popularity, ranking or authority metric for a speaker. | `ADR-0024`, `FEEDBACK.md` |
| FR-SPEAKER-008 | P2 | Areas of study are drawn from a controlled vocabulary configurable per deployment. | `docs/product/SPEAKERS.md` |

### 9.4 Programs & recurrence

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-PROGRAM-001 | P0 | A recurring kajian program can be defined with title, mosque, venue, default speaker, topics and a recurrence rule. | `docs/product/PROGRAMS.md` |
| FR-PROGRAM-002 | P0 | Recurrence supports weekly (specific weekday), monthly (nth weekday or date), and custom (explicit date list). | `docs/product/PROGRAMS.md` |
| FR-PROGRAM-003 | P0 | The system distinguishes a **Kajian Program** (the routine) from a **Kajian Event** (one occurrence with a speaker and a date). | `docs/product/PROGRAMS.md` §Critical distinction |
| FR-PROGRAM-004 | P1 | Events can be generated from a program for a date range, reviewed and adjusted before publishing. | `docs/product/PROGRAMS.md` |
| FR-PROGRAM-005 | P1 | A program can be paused or ended without affecting past events. | `docs/product/PROGRAMS.md` |
| FR-PROGRAM-006 | P2 | Program-level default registration and recording policies can be overridden per event. | `docs/product/PROGRAMS.md` |
| FR-PROGRAM-007 | P1 | Prayer-relative start times (e.g. ba'da Subuh) can be defined and displayed without asserting a fabricated clock time. | `GLOSSARY.md` §Time |

### 9.5 Kajian events

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-EVENT-001 | P0 | A kajian event can be created as a draft with title, mosque, venue, speaker, start time and timezone. | `docs/product/EVENTS.md` |
| FR-EVENT-002 | P0 | Creating an event validates required fields, that the venue belongs to the mosque, and that times are coherent (end ≥ start, start in the future for publication). | `docs/product/EVENTS.md` §Validation |
| FR-EVENT-003 | P0 | An event stores start/end in UTC plus the venue IANA timezone for display. | `ADR-0018` |
| FR-EVENT-004 | P1 | An event can be rescheduled, with participants notified and the change recorded in the audit log. | `NOTIFICATIONS.md` |
| FR-EVENT-005 | P0 | An event has a registration mode: `OPEN`, `CAPACITY_LIMITED`, `INVITATION`, `WALK_IN`, `NO_REGISTRATION`. | `REGISTRATION.md` |
| FR-EVENT-006 | P0 | An event has an attendance mode: `REGISTRATION_REQUIRED`, `REGISTRATION_OPTIONAL`, `NONE`. | `ATTENDANCE.md` |
| FR-EVENT-007 | P0 | An event has a recording policy: `NONE`, `INTERNAL`, `PUBLISH_AUDIO`, `PUBLISH_AUDIO_AND_TRANSCRIPT`. | `docs/product/CONTENT-INTEGRITY.md` |
| FR-EVENT-008 | P0 | An event has a transcription policy: `NONE`, `TRANSCRIBE_INTERNAL`, `TRANSCRIBE_REVIEW_PUBLISH`. | `TRANSCRIPTION.md` |
| FR-EVENT-009 | P1 | An event carries topics, language, audience notes (e.g. "untuk muslimah", "kajian pemuda") and an optional kitab/reference list. | `docs/product/EVENTS.md` |
| FR-EVENT-010 | P0 | An event can be published, becoming publicly discoverable with its speaker, mosque, venue and schedule. | `docs/product/EVENTS.md` |
| FR-EVENT-011 | P0 | An event can be cancelled with a reason; registrations are cancelled and participants notified. | `docs/product/EVENTS.md` §Lifecycle |
| FR-EVENT-012 | P1 | An event can be completed (manually or automatically after `endsAt`), freezing registration and check-in. | `ATTENDANCE.md` |
| FR-EVENT-013 | P1 | A completed event can be archived; archived events remain publicly readable but are excluded from default discovery lists. | `CONTENT.md` |
| FR-EVENT-014 | P0 | Public discovery lists upcoming published events and supports filtering by mosque, date range, topic and language. | `DESIGN.md` §Participant |
| FR-EVENT-015 | P1 | An event detail page shows speaker, mosque, venue, schedule in local time, capacity/remaining seats, registration state, accessibility notes and the recording/transcription policy. | `DESIGN.md` §Participant |
| FR-EVENT-016 | P1 | An event exposes a stable public slug for links and print materials. | `docs/product/EVENTS.md` |
| FR-EVENT-017 | P2 | An event can be duplicated as a template for a one-off session. | `docs/product/EVENTS.md` |

### 9.6 Registration

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-REG-001 | P0 | A participant can register for a published event whose mode permits it, in a single short form. | `REGISTRATION.md` |
| FR-REG-002 | P0 | Registration collected data is limited to: name, one contact channel, participant count, and an optional accessibility request. | `PRIVACY.md` §Minimisation |
| FR-REG-003 | P0 | A successful registration issues exactly one opaque check-in token per registration. | `ADR-0006`, `CHECKIN.md` |
| FR-REG-004 | P0 | Registration respects capacity; when full and the event allows it, the registrant is waitlisted rather than rejected without explanation. | `REGISTRATION.md` §Capacity |
| FR-REG-005 | P0 | Registration is idempotent under retry: the same client submission cannot create two registrations. | `REGISTRATION.md` §Idempotency |
| FR-REG-006 | P0 | A participant can cancel their registration before the event ends; the seat is released and an offer is made to the next waitlisted participant. | `REGISTRATION.md` §States |
| FR-REG-007 | P1 | For `INVITATION` events, a registrant needs a valid invitation to register; generic links never grant access. | `SECURITY.md` §Registration abuse |
| FR-REG-008 | P0 | For `WALK_IN` events, no registration is required and attendance is recorded at the entrance. | `CHECKIN.md` §Walk-in |
| FR-REG-009 | P1 | A registrant can view their registration and QR again without creating a new registration. | `DESIGN.md` §Participant |
| FR-REG-010 | P1 | Registration supports more than one participant count per registration only as a declared count; per-person identities are never required. | `PRIVACY.md` §Minimisation |
| FR-REG-011 | P1 | The participant can request an accessibility accommodation; the request is visible only to organizers. | `ACCESSIBILITY.md` §Requests |
| FR-REG-012 | P1 | Organizers can close registration manually before capacity or time thresholds are reached. | `REGISTRATION.md` §States |
| FR-REG-013 | P2 | Registration can collect an optional free-text "how did you hear about this?" for organizer analytics, without identification. | `docs/product/EVENTS.md` §Analytics |
| FR-REG-014 | P1 | Waitlist promotion is explicit and notified; a promoted participant's token is the same registration's token (no duplicate). | `REGISTRATION.md` §Capacity |

### 9.7 Check-in (QR)

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-CHECKIN-001 | P0 | A volunteer can open a check-in screen for one event and one venue, with the camera scanning QR codes. | `CHECKIN.md` |
| FR-CHECKIN-002 | P0 | The check-in screen resolves the current event and entrance from the operator's assignment, so the wrong event cannot be silently scanned. | `CHECKIN.md` §Correct event |
| FR-CHECKIN-003 | P0 | Camera permission failure degrades to manual entry (type/speak a short human-readable code) without blocking the entrance. | `ACCESSIBILITY.md` §QR fallback |
| FR-CHECKIN-004 | P0 | A valid token for the correct event creates at most one attendance record; repeat scans return an explicit "already checked in" result with the time of the first scan. | `CHECKIN.md` §Duplicate |
| FR-CHECKIN-005 | P0 | Tokens that belong to a different event produce a distinct, unambiguous error that names neither participant nor event details beyond what the operator needs. | `SECURITY.md` §QR |
| FR-CHECKIN-006 | P0 | Cancelled registrations cannot check in and produce an explicit result with the manual path offered. | `CHECKIN.md` §Edge cases |
| FR-CHECKIN-007 | P0 | Expired tokens cannot check in, but a valid registration for the event still has a manual path. | `RETENTION.md` §QR tokens |
| FR-CHECKIN-008 | P0 | A walk-in participant can be registered at the entrance in one short interaction (name + optional contact) and immediately counted. | `CHECKIN.md` §Walk-in |
| FR-CHECKIN-009 | P0 | Check-in works across multiple entrances/devices simultaneously and converges on one attendance record per person. | `docs/architecture/CONCURRENCY.md` |
| FR-CHECKIN-010 | P0 | The scanner gives immediate, large, unambiguous success/failure feedback and automatically resumes scanning for the next person. | `DESIGN.md` §Scanner UI |
| FR-CHECKIN-011 | P0 | The QR payload contains no personal data — only an opaque token. | `ADR-0006`, `SECURITY.md` |
| FR-CHECKIN-012 | P1 | The operator can see a live count of checked-in attendees and the event's remaining capacity. | `ATTENDANCE.md` §Summary |
| FR-CHECKIN-013 | P1 | Detected token rotation: a registration's token can be re-issued (lost/stolen phone) and the old token invalidated, with the change audited. | `SECURITY.md` §QR replay |
| FR-CHECKIN-014 | P1 | Check-in operations are attributable: who scanned, at which device/entrance, at what time. | `AUDIT` (`FR-AUDIT-003`) |
| FR-CHECKIN-015 | P2 | Operator sees a per-venue throughput figure (check-ins per minute) to decide whether to open another entrance. | `PERFORMANCE.md` |
| FR-CHECKIN-016 | P1 | Check-in degrades gracefully on unstable networks: the UI distinguishes "not yet confirmed" from "failed", and never reports success while offline. | `docs/attendance/OFFLINE-EVALUATION.md` |

### 9.8 Attendance

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-ATTEND-001 | P0 | Attendance is stored as one durable record per (event, registration) or (event, walk-in), never as a mutable count. | `ATTENDANCE.md` |
| FR-ATTEND-002 | P0 | Registered-but-not-arrived participants are reported as `NO_SHOW` only after the event's check-in window closes. | `ATTENDANCE.md` §Derivation |
| FR-ATTEND-003 | P0 | Organizers see a summary distinguishing Registered / Checked In / Walk-In / No Show / Cancelled. | `ATTENDANCE.md` §Summary |
| FR-ATTEND-004 | P1 | Organizers can correct an attendance record manually (e.g. arrived without a phone); corrections require a reason and are audited. | `FR-AUDIT-003` |
| FR-ATTEND-005 | P1 | Attendance can be exported (CSV) with a field-selection step that excludes personal data by default. | `PRIVACY.md` §Export |
| FR-ATTEND-006 | P1 | Attendance figures are never presented with false precision: when data is incomplete the UI says so explicitly. | `ATTENDANCE.md` §Honesty |
| FR-ATTEND-007 | P2 | Per-venue attendance split when an event spans multiple venues. | `ATTENDANCE.md` §Summary |
| FR-ATTEND-008 | P1 | Attendance records are retained on a schedule separate from registration data. | `RETENTION.md` |

### 9.9 Recording & audio

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-AUDIO-001 | P0 | An operator can start, pause, resume and stop a recording session for an event from a browser. | `AUDIO.md` |
| FR-AUDIO-002 | P0 | Microphone permission states are handled explicitly, including permanent denial with instructions. | `AUDIO.md` §Permission |
| FR-AUDIO-003 | P1 | The operator can select the input device and see which device is in use. | `AUDIO.md` §Devices |
| FR-AUDIO-004 | P0 | The UI shows a live input level indicator and warns about silence/clipping/very low signal. | `AUDIO.md` §Health |
| FR-AUDIO-005 | P0 | Recording is captured in short chunks; the browser must never be required to hold an entire multi-hour recording in memory. | `ADR-0008`, `AUDIO.md` §Resilience |
| FR-AUDIO-006 | P0 | Chunks are uploaded incrementally during the session, with per-chunk retry and backoff. | `docs/media/CHUNK-PROTOCOL.md` |
| FR-AUDIO-007 | P0 | Chunk upload is idempotent: uploading the same chunk twice must not corrupt or duplicate audio. | `docs/media/CHUNK-PROTOCOL.md` §Idempotency |
| FR-AUDIO-008 | P0 | A session can be recovered after a browser refresh, tab close or crash, with an explicit statement of what was and was not recovered. | `AUDIO.md` §Recovery |
| FR-AUDIO-009 | P0 | Raw uploaded audio is assembled server-side into a single continuous asset once the session is completed. | `AUDIO.md` §Assembly |
| FR-AUDIO-010 | P1 | Assembled audio is processed (normalised loudness, canonical container) into a published-quality derivative. | `docs/media/AUDIO-QUALITY.md` |
| FR-AUDIO-011 | P1 | Audio assets are stored privately; playback access is authorised per event policy, never by guessed URL. | `SECURITY.md` §Storage |
| FR-AUDIO-012 | P1 | A transcription derivative (16 kHz mono) is produced separately and never replaces the archive master. | `docs/media/AUDIO-PIPELINE.md` |
| FR-AUDIO-013 | P1 | The event's recording policy is displayed to organizers before recording and is stored on the recording session. | `docs/product/CONTENT-INTEGRITY.md` §Consent |
| FR-AUDIO-014 | P1 | An operator can attach a note/annotation to the session (e.g. "microphone moved at minute 40"). | `AUDIO.md` §Operations |
| FR-AUDIO-015 | P2 | Multiple concurrent sessions (phone + laptop) for the same event are permitted as separate assets, never merged silently. | `AUDIO.md` §Multiple sessions |
| FR-AUDIO-016 | P1 | Failed or abandoned sessions are clearly marked, and their partial audio is either recoverable or explicitly deleted per retention. | `RETENTION.md` §Audio |
| FR-AUDIO-017 | P2 | A speaker/organizer can download the archive master for their own records. | `CONTENT.md` §Ownership |

### 9.10 Transcription

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-TRANSCRIPT-001 | P0 | An authorized organizer can request transcription for a completed audio asset. | `TRANSCRIPTION.md` |
| FR-TRANSCRIPT-002 | P0 | Transcription runs asynchronously; the UI shows a truthful status with progress indication and never blocks other work. | `TRANSCRIPTION.md` §States |
| FR-TRANSCRIPT-003 | P0 | The transcription provider is behind a port; no provider-specific type appears in the domain or API contracts. | `ADR-0011` |
| FR-TRANSCRIPT-004 | P1 | The transcription request can declare expected language(s), including a code-switching hint set (Bahasa Indonesia, Arabic, English, local languages). | `docs/transcription/CODE-SWITCHING.md` |
| FR-TRANSCRIPT-005 | P1 | Raw transcript output preserves segment timestamps suitable for audio navigation. | `TRANSCRIPTION.md` §Segmentation |
| FR-TRANSCRIPT-006 | P0 | A machine transcript enters `REVIEW_REQUIRED`; it can never become `PUBLISHED` without an explicit human approval by an authorized reviewer. | `ADR-0012` |
| FR-TRANSCRIPT-007 | P1 | Reviewers can edit text, split/merge segments, adjust timestamps and correct Arabic/Islamic terminology. | `docs/transcription/REVIEW-WORKFLOW.md` |
| FR-TRANSCRIPT-008 | P1 | Reviewers can mark a segment or span as uncertain/unverified, and that marking survives into the published artefact's metadata. | `docs/product/CONTENT-INTEGRITY.md` |
| FR-TRANSCRIPT-009 | P0 | Every save in review produces an immutable `TranscriptRevision` with author and timestamp. | `DATA_MODEL.md` §TranscriptRevision |
| FR-TRANSCRIPT-010 | P0 | The system distinguishes machine output from human-reviewed text in storage, API and UI (`source: MACHINE \| HUMAN \| MIXED`). | `TRANSCRIPTION.md` §Provenance |
| FR-TRANSCRIPT-011 | P1 | An approved transcript can be published to the archive only if the event's transcription policy allows publication. | `docs/product/CONTENT-INTEGRITY.md` |
| FR-TRANSCRIPT-012 | P1 | Published transcripts can be unpublished (with a reason) while the revision history is preserved. | `CONTENT.md` §Moderation |
| FR-TRANSCRIPT-013 | P1 | A published transcript is searchable and navigable by timestamp. | `CONTENT.md` §Search |
| FR-TRANSCRIPT-014 | P2 | Transcript export (plain text, SRT/VTT, and a citation-friendly format) is available to authorized roles. | `CONTENT.md` |
| FR-TRANSCRIPT-015 | P1 | Reviewer identity is recorded and visible to organizers and the speaker for published content. | `FR-AUDIT-003` |
| FR-TRANSCRIPT-016 | P2 | A reviewer can flag a passage for the speaker's attention instead of guessing (e.g. an unclear hadith attribution). | `docs/transcription/REVIEW-WORKFLOW.md` |

### 9.11 Content archive

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-CONTENT-001 | P0 | A completed event with published media exposes a public page with title, speaker, mosque, date, topics, audio player and transcript. | `CONTENT.md` |
| FR-CONTENT-002 | P1 | Content can carry timestamp chapters ("menit 12: adab menuntut ilmu"). | `CONTENT.md` §Chapters |
| FR-CONTENT-003 | P1 | Organizers/speakers can attach reference materials (kitab name, article links, slide/PDF) to the event. | `CONTENT.md` §Materials |
| FR-CONTENT-004 | P1 | Content is searchable by text across titles, topics, speaker names and approved transcripts, respecting visibility rules. | `CONTENT.md` §Search |
| FR-CONTENT-005 | P2 | Any AI-generated summary must be labelled as generated and must not be publishable without review; it never replaces the transcript. | `docs/product/CONTENT-INTEGRITY.md` |
| FR-CONTENT-006 | P1 | Any published content can be unpublished by a moderator with a recorded reason and a notification to the owner. | `CONTENT.md` §Moderation |
| FR-CONTENT-007 | P1 | An event marked `RECORDING_POLICY: INTERNAL` never exposes audio or transcript publicly, and the UI states this. | `docs/product/CONTENT-INTEGRITY.md` §Policy enforcement |

### 9.12 Feedback

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-FEEDBACK-001 | P0 | A participant can submit feedback for an event they attended or registered for. | `FEEDBACK.md` |
| FR-FEEDBACK-002 | P1 | Feedback collects a small set of operational ratings (registration experience, venue, sound quality, topic relevance, organization, overall) plus optional free text. | `FEEDBACK.md` §Dimensions |
| FR-FEEDBACK-003 | P1 | Feedback can be submitted anonymously; anonymity must be enforced at the data layer (no participant link stored for anonymous submissions). | `ADR-0016` |
| FR-FEEDBACK-004 | P1 | Free-text feedback is visible to organizers; speakers see aggregate ratings and a filtered set of comments of operational relevance. | `FEEDBACK.md` §Visibility |
| FR-FEEDBACK-005 | P0 | Feedback must never produce a public ranking, score or comparison of speakers. | `FR-SPEAKER-007` |
| FR-FEEDBACK-006 | P1 | Feedback containing abuse, or targeting a person rather than operations, can be reported and hidden without deleting the audit trail. | `CONTENT.md` §Moderation |
| FR-FEEDBACK-007 | P1 | A feedback request is sent only to people plausibly present (checked-in or registered for the event), never to the general public. | `NOTIFICATIONS.md` §Triggers |
| FR-FEEDBACK-008 | P1 | Feedback is retained in aggregated/anonimised form after the raw retention window expires. | `RETENTION.md` §Feedback |

### 9.13 Notifications

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-NOTIF-001 | P1 | A registrant receives a confirmation containing the event details and the check-in code/QR. | `NOTIFICATIONS.md` |
| FR-NOTIF-002 | P1 | A registrant receives a reminder before the event, at a configurable lead time. | `NOTIFICATIONS.md` §Triggers |
| FR-NOTIF-003 | P1 | Participants are notified of cancellations and location/venue changes with the reason. | `NOTIFICATIONS.md` §Triggers |
| FR-NOTIF-004 | P1 | Participants can be notified when a recording or a reviewed transcript becomes available. | `CONTENT.md` §Distribution |
| FR-NOTIF-005 | P1 | A feedback request is sent only after the event, once, with a limit on repeats. | `NOTIFICATIONS.md` §Dedupe |
| FR-NOTIF-006 | P1 | Notification delivery is asynchronous via an outbox; failures are retried and visible to operators. | `NOTIFICATIONS.md` §Delivery |
| FR-NOTIF-007 | P1 | Channels: in-app (default) and email. WhatsApp/SMS/Telegram are optional adapters added post-MVP. | `docs/research/STACK-2026.md` §18 |
| FR-NOTIF-008 | P1 | Users can opt out of non-essential notifications (reminders stay optional, operational messages like cancellation remain). | `PRIVACY.md` §Consent |
| FR-NOTIF-009 | P2 | A mosque/organization can broadcast an announcement to its program's participants (opt-in, rate-limited). | `NOTIFICATIONS.md` §Announcements |
| FR-NOTIF-010 | P1 | Notifications never contain QR tokens or other secrets in plain text in a channel that cannot be access-controlled. | `SECURITY.md` §Token leakage |

### 9.14 Analytics, moderation, audit

| ID | Pri | Requirement | Spec |
|---|---|---|---|
| FR-ANALYTICS-001 | P1 | An organizer dashboard shows: upcoming kajian, registration count, capacity, checked-in count, attendance rate, recording status, transcription status, feedback status. | `OBSERVABILITY.md` §Dashboards |
| FR-ANALYTICS-002 | P1 | Actionable operational alerts are raised for defined conditions and are deduplicated. | `OBSERVABILITY.md` §Alerts |
| FR-ANALYTICS-003 | P2 | Funnel metrics (view → register → check-in) are available per event without identifying individuals. | `PRIVACY.md` §Analytics |
| FR-ANALYTICS-004 | P0 | No third-party advertising or behavioural tracking script is permitted in participant-facing pages. | `NFR-PRIV-008` |
| FR-MOD-001 | P1 | Any user can report published content; reports are queued for moderators. | `CONTENT.md` §Moderation |
| FR-MOD-002 | P1 | A moderator can unpublish content, request changes, and record an outcome with a reason. | `CONTENT.md` §Moderation |
| FR-MOD-003 | P1 | A moderator can suspend a speaker profile's public visibility pending verification, without deleting historical records. | `docs/product/SPEAKERS.md` |
| FR-MOD-004 | P1 | Moderation decisions are audited and appealable by the content owner. | `FR-AUDIT-002` |
| FR-AUDIT-001 | P0 | Security- and integrity-relevant actions append immutable audit events. | `AUDIT` `SECURITY.md` §Audit |
| FR-AUDIT-002 | P1 | Platform/admin actions (verification, moderation, role changes) are audited with actor, target, reason. | `SECURITY.md` §Audit |
| FR-AUDIT-003 | P1 | Attendance corrections, token re-issues and transcript approvals are audited with actor and reason. | `ATTENDANCE.md` §Corrections |
| FR-AUDIT-004 | P1 | Authorized administrators can query audit events by actor, target, type and time range, with results exportable. | `SECURITY.md` §Audit |
| FR-AUDIT-005 | P2 | Audit events support a retention that outlives the data they describe (see `RETENTION.md`). | `RETENTION.md` §Audit |

## 10. Non-functional requirements

### Security (`NFR-SEC-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-SEC-001 | P0 | Every mutating API requires an authenticated principal unless it is an explicitly public operation (registration for an `OPEN` event). |
| NFR-SEC-002 | P0 | Authorization is enforced **server-side** on every request, including Server Actions and route handlers; UI hiding is never a control. |
| NFR-SEC-003 | P0 | Organization isolation is enforced on every scoped query; no endpoint accepts an unscoped id without an ownership check. |
| NFR-SEC-004 | P0 | Check-in tokens are opaque, high-entropy (≥128 bits), stored hashed, and compared in constant time. |
| NFR-SEC-005 | P0 | QR payloads contain no PII and no raw database identifiers. |
| NFR-SEC-006 | P0 | All state-changing requests require CSRF protection (SameSite cookies + origin checks) and safe methods are idempotent. |
| NFR-SEC-007 | P0 | All user-generated content is escaped/output-encoded; stored HTML is not permitted (Markdown subset only). |
| NFR-SEC-008 | P0 | All database access uses parameterised queries; raw string concatenation into SQL is forbidden. |
| NFR-SEC-009 | P0 | File/audio uploads are size-limited, content-type-verified by sniffing, and never executed or served from the app origin as active content. |
| NFR-SEC-010 | P0 | Rate limits exist on registration, check-in, token validation, upload and auth endpoints; limits are durable across restarts. |
| NFR-SEC-011 | P0 | Secrets are supplied via environment/secret manager, never committed, and rotated by procedure (`OPERATIONS.md`). |
| NFR-SEC-012 | P1 | A security advisory intake and patch SLA exists (critical ≤ 72h) and dependency review runs monthly. |

### Privacy (`NFR-PRIV-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-PRIV-001 | P0 | Data minimisation: no field may be collected without a stated purpose in `PRIVACY.md` §Data inventory. |
| NFR-PRIV-002 | P0 | A participant may request access to and deletion of their personal data; deletion propagates per `RETENTION.md`. |
| NFR-PRIV-003 | P0 | Recording and publication policy is explicit per event and shown before recording starts. |
| NFR-PRIV-004 | P0 | Voice recordings are personal data: processed under a stated lawful basis, private by default. |
| NFR-PRIV-005 | P0 | Analytics are aggregate; no individual participant behaviour profile is built or exported. |
| NFR-PRIV-006 | P0 | Logs and telemetry never contain raw audio, transcript content, contact details or tokens. |
| NFR-PRIV-007 | P1 | Third-party processors (hosted STT, email, hosting) are documented with data categories, region and purpose; no voice data leaves the boundary without an explicit deployment decision. |
| NFR-PRIV-008 | P0 | Participant data is never sold, shared or used for advertising. |
| NFR-PRIV-009 | P1 | Any breach triggers the documented 72-hour notification procedure (UU PDP). |

### Performance (`NFR-PERF-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-PERF-001 | P0 | Event discovery list is server-rendered and interactive within 2.5 s on a mid-range Android phone on 3G Fast (see `PERFORMANCE.md` for the full budget). |
| NFR-PERF-002 | P0 | QR token validation p95 ≤ 300 ms server-side, excluding network. |
| NFR-PERF-003 | P0 | A check-in is complete (scan → visible confirmation) in ≤ 1 s p95 on a 4G connection and ≤ 2.5 s p95 on 3G. |
| NFR-PERF-004 | P0 | The check-in screen sustains ≥ 20 check-ins/minute from a single device; the server sustains ≥ 200 scans/minute per event with p95 ≤ 300 ms. |
| NFR-PERF-005 | P0 | Audio chunk upload of 10 s of Opus completes within the chunk interval on 3G; upload backlog must never grow unbounded during a session. |
| NFR-PERF-006 | P0 | Organizer dashboard first contentful paint ≤ 2 s on desktop broadband with warm cache. |
| NFR-PERF-007 | P1 | Registration submission p95 ≤ 800 ms. |
| NFR-PERF-008 | P1 | Published transcript page loads its first screenful ≤ 1.5 s and streams the rest. |
| NFR-PERF-009 | P1 | Search returns results p95 ≤ 700 ms for the first page. |
| NFR-PERF-010 | P1 | Recording start (press → capturing) ≤ 1.5 s after permission is granted. |

### Reliability (`NFR-REL-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-REL-001 | P0 | A 2-hour recording survives: browser refresh, tab close and reopen, network loss up to 30 minutes, and one process restart, without losing more than the last partial chunk interval. |
| NFR-REL-002 | P0 | Check-in never reports success for attendance that was not committed. |
| NFR-REL-003 | P0 | Duplicate submissions of the same mutation converge to one record (idempotency), verified by concurrency tests. |
| NFR-REL-004 | P1 | Background jobs are retried with backoff, dead-lettered on exhaustion, and never silently dropped. |
| NFR-REL-005 | P1 | Object storage failures degrade recording to local buffering with an explicit, visible warning rather than silent loss. |
| NFR-REL-006 | P1 | Managed availability target: 99.5% monthly for participant-facing read paths; check-in has a documented degraded mode. |

### Accessibility (`NFR-A11Y-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-A11Y-001 | P0 | WCAG 2.2 AA conformance for participant-, volunteer- and reviewer-facing screens. |
| NFR-A11Y-002 | P0 | Minimum touch target 44×44 CSS px; primary check-in feedback is perceivable without colour and at ≥ 1 m distance. |
| NFR-A11Y-003 | P0 | QR is never the only check-in mechanism; a manual code/name fallback always exists. |
| NFR-A11Y-004 | P0 | All flows are fully keyboard-operable, including the scanner's manual fallback and the recorder controls. |
| NFR-A11Y-005 | P0 | Body text ≥ 16 px, contrast ≥ 4.5:1, no text in images, no reliance on hover. |
| NFR-A11Y-006 | P1 | Screen-reader announcements for check-in results and recording state changes (live regions), without leaking PII. |
| NFR-A11Y-007 | P1 | Published audio has a transcript (or an explicit "transcript not available" statement) and transcripts are semantically structured for assistive tech. |
| NFR-A11Y-008 | P1 | Supported and tested at 200% zoom and with OS font scaling, on 360 px-wide screens. |

### Observability (`NFR-OBS-*`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-OBS-001 | P0 | Every request carries a correlation id propagated through logs, traces and job payloads. |
| NFR-OBS-002 | P0 | Structured JSON logs with allow-listed attributes; no PII, audio or transcript content. |
| NFR-OBS-003 | P0 | Metrics exist for registration outcomes, check-in outcomes/duplicates, upload failures, recording interruptions, transcription duration/failures, storage and DB latency, notification failures. |
| NFR-OBS-004 | P0 | OpenTelemetry traces (OTLP) instrument HTTP handlers, jobs and storage operations; vendor-neutral. |
| NFR-OBS-005 | P1 | Organizer-visible alerts are distinct from operator-visible alerts and are deduplicated (`OPERATIONAL_ALERTS`). |
| NFR-OBS-006 | P1 | Each SLO in `docs/operations/SLO.md` has a dashboard panel and an alert. |
| NFR-OBS-007 | P1 | Log retention and access are defined and private (log content is still personal data when it contains identifiers). |
| NFR-OBS-008 | P2 | Recording session telemetry includes chunk gaps and upload backlog as first-class quality signals. |

### Mobile, i18n, operability, ethics (`NFR-MOB/I18N/OPS/ETH`)

| ID | Pri | Requirement |
|---|---|---|
| NFR-MOB-001 | P0 | All participant and volunteer flows work in Chrome/Android, Safari/iOS 17+, and Firefox current, at 360 px width. |
| NFR-MOB-002 | P0 | Camera and microphone usage is user-initiated, with explicit purposes and graceful denial handling. |
| NFR-MOB-003 | P0 | Core participant flows work on a 3G-class connection with < 1 MB initial JS for participant pages. |
| NFR-MOB-004 | P1 | The participant's check-in code is reachable offline (cached page/screenshot guidance, downloadable QR) — the *client* does not need the network to *display* it. |
| NFR-MOB-005 | P1 | PWA installability with offline shell for "my registration" and check-in code display. |
| NFR-MOB-006 | P1 | No dependence on exotic device features; no requirement for gyroscope/NFC/Bluetooth. |
| NFR-I18N-001 | P0 | User-facing copy is Bahasa Indonesia by default with an English locale available. |
| NFR-I18N-002 | P0 | Dates/times render in the venue timezone with locale-aware formatting and no ambiguous numeric dates. |
| NFR-I18N-003 | P1 | Text input supports Arabic script throughout (no ASCII-only validation, correct bidi rendering in the transcript editor). |
| NFR-I18N-004 | P1 | Prayer-relative times may be displayed without conversion; conversion requires a configured prayer-time source. |
| NFR-OPS-001 | P0 | Single-command local development (compose: Postgres + storage + collector). |
| NFR-OPS-002 | P0 | Production topology is documented, reproducible from the repository, and restorable from backup (`docs/operations/BACKUP-RESTORE.md`). |
| NFR-OPS-003 | P0 | Rollback is possible within 10 minutes for the web tier and the worker. |
| NFR-OPS-004 | P1 | All configuration is environment-driven and validated at boot with a fail-fast check. |
| NFR-OPS-005 | P1 | A single operator can run the platform for ≤ 500 events/month with no routine manual intervention. |
| NFR-OPS-006 | P2 | Cost per event is documented and predictable; no per-seat or per-scan licensing. |
| NFR-ETH-001 | P0 | No ranking/popularity/authority scoring of speakers anywhere in data, API, UI or exports. |
| NFR-ETH-002 | P0 | Machine-generated religious text is never presented as reviewed or authoritative. |
| NFR-ETH-003 | P0 | Content ownership and publication authority rest with the speaker/organizer, not the platform. |
| NFR-ETH-004 | P1 | Organizers cannot be nudged toward engagement-maximising behaviour (no streaks, no prompts to "boost" reach). |

## 11. Mobile requirements

1. **Entrance-first performance.** The check-in screen must open in ≤ 2 s on a 4-year-old
   Android phone with 4G, and every interaction must survive a lost connection without
   ambiguity (`NFR-PERF-003`, `FR-CHECKIN-016`).
2. **One-hand operation.** Primary actions within the bottom third of the screen; no
   horizontal scrolling; no pinch-zoom requirements.
3. **Data frugality.** Participant pages ≤ 1 MB initial JS; QR image is generated
   server-side and cacheable; no video autoplay.
4. **Screen brightness and glare.** Scanner and check-in result states must be readable in
   daylight; high-contrast feedback, no subtle greys for critical states.
5. **Offline-tolerant participant experience.** A participant must be able to *display* their
   QR without network (`NFR-MOB-004`).
6. **Device variability.** No assumption of modern hardware for volunteers; the operator
   console is the only place allowed to assume a recent device, and even there the
   fallback path must work.
7. **Battery and thermal.** Recording and scanning sessions must not require the screen to
   stay awake in a way that kills the device; audio recording should continue with the
   screen off where the platform allows.

## 12. Privacy requirements (product-level)

- Collect the minimum: name, one contact channel, count, optional accessibility request.
  No date of birth, no national ID, no address, no gender.
- Every additional field requires a documented purpose in `PRIVACY.md` §Data inventory.
- Recording/transcription/publication intent is declared **before** the event and displayed
  to organizers at recording start.
- Children's data: no separate child accounts; a parent registering a child declares it in
  free text at their own risk, and the system does not build profiles of children.
- Data subject requests (access/deletion) have a documented procedure and SLA.
- Cross-organization leakage is treated as a P0 privacy incident, not a bug.
- Aggregate reporting is the default; row-level export requires an explicit role.

## 13. Security requirements (product-level)

- Never trust the client for authorization, capacity, attendance or token validity.
- Tokens are secrets: hashed at rest, never logged, never placed in notifications in plain
  form if the channel is not access-controlled.
- Uploads are hostile input: validate size, sniff type, quarantine before processing.
- Admin surfaces are separated by role, rate-limited and audited.
- The system must remain safe when an entire browser in the entrance queue is compromised:
  a stolen *participant* token must be worth only one attendance record for one event.

## 14. Accessibility requirements

WCAG 2.2 AA target, with the specific commitments in `ACCESSIBILITY.md`:
keyboard operability, screen-reader semantics on live states, 44 px targets, QR fallback,
large-type mode for older participants, no colour-only signalling, captions/transcripts for
audio (or an explicit absence statement), and form errors announced in text.

## 15. Operational requirements

- One deployment must be operable by one technical volunteer: documented topology,
  single-command deploy, backups with a tested restore, log/metric access without a data
  team.
- Alerts must be actionable and few (`OBSERVABILITY.md` §Alerts). An alert that cannot be
  acted on is deleted or moved to a report.
- Cost must be predictable: per-event storage growth is modelled in `OPERATIONS.md`; a
  2-hour kajian's retained audio is a known quantity.
- No operational dependency on a channel the mosque does not control (e.g. a messaging
  vendor's API) for core flows.

## 16. Edge cases (product-level register)

| # | Edge case | Expected product behaviour |
|---|---|---|
| E1 | Capacity is exactly reached by two simultaneous registrations | One is `REGISTERED`, the other is `WAITLISTED`/rejected; the system never oversells (`docs/architecture/CONCURRENCY.md` C1) |
| E2 | Participant without a phone arrives | Volunteer finds them by name in the participant list and records attendance manually with a reason |
| E3 | Phone battery dies at the entrance | Token can be re-fetched on another device via account/contact lookup; the token value is not the *only* path to attendance |
| E4 | Wi-Fi dies mid-recording | Recording continues locally; chunks queue; UI explicitly warns "not yet uploaded"; recovery on reconnect (`NFR-REL-001`) |
| E5 | Browser crashes mid-recording | Session is recoverable up to the last acknowledged chunk; the UI reports exactly what was recovered |
| E6 | Speaker is replaced at the last minute | Event can be rescheduled/updated with the new speaker; participants are notified; historical record reflects the change |
| E7 | Two volunteers register the same walk-in | Converge to one attendance record; the second attempt reports "already registered" (`CONCURRENCY` C5) |
| E8 | Two reviewers edit the same transcript | Optimistic concurrency: the second save is rejected with a diff-based conflict notice, never silently overwritten (`CONCURRENCY` C6) |
| E9 | Chunks arrive out of order or duplicated | Assembly is sequence-based and idempotent; duplicates are ignored, gaps are reported as gaps (`CONCURRENCY` C7/C8) |
| E10 | Transcription provider returns malformed/empty output | Job fails visibly with a retriable state; no partial transcript is shown as complete |
| E11 | Event cancelled after registration | Registrations cancelled, participants notified with reason, no attendance expected; tokens become unusable |
| E12 | Event moved to another venue in the same mosque | Participants see the new location prominently; check-in follows the event, not the old venue |
| E13 | A person registers but attends a different venue of the same event | Attendance recorded against the event, with venue attribution per-entrance |
| E14 | A Qur'anic verse is transcribed incorrectly | Preserved verbatim, flagged uncertain, corrected **only** by a human reviewer, with revision history (`CONTENT-INTEGRITY`) |
| E15 | A speaker asks to be removed from the platform | Profile unlisted; published content ownership resolved explicitly; attendance records retained as records, not as a profile |
| E16 | Mosque closes permanently | Existing events archived, no new events possible, data retained per retention policy, deletion available on request |
| E17 | Organizer loses interest / stops operating | Alerts simply do not exist; the system must not accumulate notifications or spam participants in their absence |
| E18 | Recording started by mistake | Can be discarded; if partly uploaded, retention deletes it per the discarding rule; it is never auto-published |

## 17. Acceptance criteria (product-level)

The product is accepted for production when **all** P0 requirements are implemented,
verified and traceable, and specifically:

1. **Discovery → attendance** is complete end to end for a `CAPACITY_LIMITED` event with 300
   registrations and a simulated entrance of 500 arrivals across 3 devices, with zero
   duplicate attendance records.
2. **A 2-hour recording** completes with an injected 30-minute network outage, one browser
   crash and one server restart, losing no acknowledged chunk, and producing a playable
   archive asset.
3. **No machine transcript** can reach `PUBLISHED` without an approving human revision; a
   test asserts this at the API and the database level.
4. **Data minimisation** is verifiable: a participant-facing registration form collects at
   most the four permitted fields.
5. **Isolation** is verifiable: an authorization test suite attempts cross-organization
   access on every scoped endpoint and fails all of them.
6. **Accessibility**: an automated axe pass plus a manual keyboard+screen-reader script
   (`ACCESSIBILITY.md` §Verification) passes on the participant, check-in and reviewer flows.
7. **Operations**: a new operator can deploy, back up and restore using only
   `DEPLOYMENT.md`, `OPERATIONS.md` and `RUNBOOK.md`.
8. **Observability**: the SLOs in `docs/operations/SLO.md` have dashboards and alerts, and a
   synthetic incident (upload failure) is detected by an alert.

## 18. Success metrics

Product success is measured on **attendance integrity, content durability and organizer
burden** — never on engagement.

| # | Metric | Target | Why it matters |
|---|---|---|---|
| M1 | Check-in success rate (arrivals with a valid registration) | ≥ 99% first-scan success | The entrance must not fail people |
| M2 | Duplicate / conflicting attendance records | 0 | Integrity of the record |
| M3 | Median check-in time per participant (scan → confirmation) | ≤ 3 s | Queue throughput |
| M4 | Recordings completed without data loss | ≥ 99%, gaps ≤ 30 s per 2 h | The teaching is preserved |
| M5 | Recording → playable on the event page | ≤ 60 min p95 after session end | Content actually ships |
| M6 | Recording → published transcript | ≤ 7 days p95, with 100% human review | Realistic review capacity |
| M7 | Machine transcripts published without human approval | 0 incidents | Religious content integrity |
| M8 | Registration completion rate (started → registered) | ≥ 80% | Low friction is working |
| M9 | Organizer time per event (setup, check-in, publish) | ≤ 30 min excluding the recording itself | Volunteer sustainability |
| M10 | Events with feedback submitted | ≥ 15% of attendees | Enough signal to improve |
| M11 | Accessibility conformance | 0 critical axe violations on P0 flows | Older participants |
| M12 | Data minimization | 100% of collected fields have a documented purpose | UU PDP posture |
| M13 | Cost per event (storage + processing) | documented and ≤ a stated ceiling; reviewed per quarter | Committee trust |
| M14 | Speaker ranking artefacts in the product | 0 (structural) | Product ethics `NFR-ETH-001` |

**Anti-metrics (explicitly not optimised):** session length, daily active users, notification
click-through, number of kajian attended per person, shares, "engagement".

## 19. Withdrawn / deferred requirements

| ID | Status | Note |
|---|---|---|
| FR-CHECKIN-013 | P1, *deferred to VS-4.5* | Token re-issue is designed but scheduled after the core entrance flow is proven |
| FR-NOTIF-009 | P2, *deferred to post-VS-12* | Announcements need an abuse/rate-limit design first |
| FR-CONTENT-005 | P2, *deferred, gated* | AI summary is gated behind content-integrity review and must remain labelled generated |
| FR-REG-007 | P1, *in VS-3* | Invitation links are provisioned with the same token machinery as check-in |
| FR-ATTEND-007 | P2, *deferred* | Multi-venue attendance split only if a deployment actually runs split events |
| FR-PROGRAM-007 | P1, *VS-2* | Prayer-relative times are display-only until a prayer-time source is configured |
