# PRIVACY

MajelisHub processes personal data about religious participation, contact details, and voices.
This document states what is collected, why, for how long, who can see it, and what rights data
subjects have.

Requirements: NFR-PRIV-001…009 · ADRs: 0016 (feedback), 0006 (tokens), 0013 (storage), 0017 (tenancy)
· Retention: `RETENTION.md` · Legal context: Indonesian **UU PDP** (Law 27/2022)

---

## 1. Legal context and posture

- **UU PDP** (in force since October 2024; penalties up to 2% of annual revenue; breach notification
  within 72 hours; the PDP supervisory agency is being established through 2026). MajelisHub targets
  UU PDP compliance by design, and aligns with GDPR-equivalent expectations where they are stricter.
- The **operator of a deployment** is the data controller; the software is built so that a mosque or
  community can meet its obligations with the tools provided (notices, consent capture, retention
  jobs, export, deletion).
- Two categories of data require extra care:
  1. **Voice recordings and transcripts** — personal data, and the content may include religious
     speech and quotation of sacred texts.
  2. **Attendance records** — reveal participation in religious gatherings. Inferences about
     religious belief are sensitive; the system treats them accordingly even where a jurisdiction
     does not (a general privacy stance, not a legal claim).

## 2. Lawful basis and purpose

| Purpose | Basis | Scope |
|---|---|---|
| Deliver the service the participant asked for (a seat, a code, updates about *this* event) | Contract/request fulfilment; explicit consent for the contact channel | registration + notifications for that event |
| Organizer reporting (how many came) | Legitimate interest of the mosque/community in operating its activities; **aggregate by default** | attendance counts |
| Recording and publication | **Explicit, event-level policy** selected by the organizer and shown to participants; publication is a separate, deliberate act | audio, transcript |
| Transcription | The event's transcription policy; **self-hosted by default** so voice data does not leave the operator's boundary without a decision | derivative audio + text |
| Feedback | Consent (submission is voluntary; anonymity offered) | feedback |
| Platform operation (security, abuse prevention, audit) | Legitimate interest; minimised and time-limited | logs, audit |
| Improving the product | **Aggregate only**; no individual behaviour profiling | metrics |

**Purpose limitation:** contact details are used only for kajian lifecycle messages for the event(s)
the person registered for. There is no marketing, no cross-promotion to other mosques, and no
profiling.

## 3. Data inventory (the complete list of personal data)

| Data | Category | Collected from | Purpose | Visibility | Retention |
|---|---|---|---|---|---|
| Participant name | Identity | participant | admission, reporting | organizers of the event; **first name only** on the scanner | registration: 18 months (`RETENTION.md`) |
| Contact (email/WhatsApp/SMS) | Contact | participant | code delivery, event updates, own access | organizers (masked, for lookup); never public | 18 months; deleted earlier on request |
| Contact hash | Derived | system | dedupe/uniqueness | internal only | with registration |
| Participant count | Operational | participant | capacity accounting | organizers | with registration |
| Accessibility request | **Special-category-adjacent** (health/ability) | participant (optional) | accommodation | organizers of the event only | deleted with registration (18 months) |
| Registration status | Operational | system | service | organizers; participant (own) | 18 months |
| Attendance record | Behaviour/association | system | reporting | organizers of that event; admins in audited support cases | 24 months, then aggregate only |
| Check-in token (hash) | Credential | system | admission | internal only | deleted 30 days after the event |
| Recording (voice) | **Biometric-adjacent / content** | operator | archive, publication per policy | per policy (`INTERNAL` = organizers only) | 24 months default (configurable), see `RETENTION.md` |
| Transcript text | Content | provider/reviewer | accessibility, search | per policy; drafts internal | published 7 years; drafts 12 months |
| Transcript revisions | Provenance | system | integrity/audit | reviewers, organizers | as above |
| Feedback (ratings + comment) | Opinion | participant | improve operations | organizers; speaker (aggregate ≥ 5, comments only if shared) | raw 12 months, then aggregates |
| Feedback anonymity flag | Control | participant | honour anonymity | internal | with feedback |
| Speaker profile data | Identity/Professional | speaker or organizer | discovery | public (by design) | until unlisted/deleted |
| Organizer account data | Identity/Contact | organizer | access control | internal; visible to org owners | account life |
| Audit events | Accountability | system | security/integrity | authorized admins | 7 years |
| Telemetry (logs/metrics/traces) | Technical | system | operations | operators | 30–90 days, **no personal data** |
| IP address (hashed) | Technical | network | abuse prevention | internal | 30 days |

**Not collected:** national ID, date of birth, gender, home address, occupation, photos of
participants, precise geolocation of participants, religious-affiliation declarations, payment data,
children's accounts.

**Derived-profiles prohibition:** no per-participant history, no "attendance streak", no
cross-event profile of a jamaah is created or made available to any role. Attendance is an event
fact, not a participant dossier (`ATTENDANCE.md` §9).

## 4. Consent and notice

| Moment | What the person sees | Stored evidence |
|---|---|---|
| Before registering | One-line purpose statement: what the contact channel will be used for, and that it will not be shared | `consent.contactUse` + timestamp |
| When the event records audio | A statement on the event page **before** the event: "Sesi ini direkam dan akan dipublikasikan" (or `INTERNAL`) | `recordingPolicy` on the event + notice text version |
| At feedback submission | Honest statement of whether the submission is anonymous, and who will see it | `is_anonymous` + notice version |
| At speaker profile creation | Notice that a profile is public and what it contains | profile `listing_state` |
| Recording start (operator) | The policy is displayed; the operator confirms the device and venue | policy snapshot on the session |

**Attending a kajian is not consent to arbitrary recording or publication.** The product therefore
never infers consent from attendance; it requires an explicit policy set at publish time, surfaces
it to participants before the event, and requires a deliberate publication action afterwards
(`docs/product/CONTENT-INTEGRITY.md` §Consent). Jurisdiction-sensitive note: some deployments may
require a spoken announcement or a posted notice; `RUNBOOK.md` includes an operational reminder for
organizers ("bacakan pemberitahuan rekaman"), but the product does not claim to obtain consent on
anyone's behalf.

## 5. Access control (who can see what)

| Data | Public | Participant (own) | Organizer | Speaker | Reviewer | Moderator | Admin |
|---|---|---|---|---|---|---|---|
| Event/speaker/mosque (published) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Published audio/transcript | per policy | per policy | ✓ | ✓ (own) | ✓ | ✓ | ✓ |
| Participant name/contact | — | own only | scoped events | — | — | — | audited only |
| Attendance detail | — | own | scoped events | aggregate of own events | — | — | audited only |
| Feedback raw | — | — | scoped events | only shared comments (n ≥ 5 aggregates) | — | reported items only | audited only |
| Audit | — | — | own org (scoped) | — | — | content only | ✓ |

Rules: least privilege; `TenantScope` enforced server-side; **no bulk participant explorer**; support
access requires a reason and is audited (B9 boundary in `THREAT_MODEL.md`).

## 6. Anonymity guarantee (feedback)

The anonymity promise is implemented as **absence of data**, not as a hidden flag (ADR-0016):
anonymous feedback rows carry no registration id and no contact; timestamps are day-granular;
aggregates with n < 5 are suppressed; audit entries for anonymous submissions name no actor. This is
verifiable by schema inspection, which is the only kind of privacy guarantee worth making.

## 7. Retention and deletion (summary; detail in `RETENTION.md`)

| Data | Default retention | After retention |
|---|---|---|
| Registration + contact | 18 months after the event | deleted |
| Attendance records | 24 months after the event | aggregated (counts only) |
| Check-in tokens | 30 days after the event | deleted |
| Raw audio master | 24 months (configurable 6–60) | deleted or archived per operator policy |
| Transcription derivative audio | 30 days after successful transcription | deleted |
| Published transcripts + revisions | 7 years | review with the owner |
| Transcript drafts (never published) | 12 months after the event | deleted |
| Feedback raw | 12 months after the event | aggregates only |
| Audit events | 7 years | reviewed |
| Telemetry | 30–90 days | deleted |
| Exports | 7 days | deleted |

**Deletion is a real deletion** (rows removed, objects deleted), not a status change. Retention runs
produce a **deletion evidence record** (counts and policy keys; no personal data) and are audited.

## 8. Data-subject rights (procedures the product supports)

| Right | How it is served | SLA |
|---|---|---|
| Access | A participant can view their own registration via their capability link; a written request is served by an organizer using the audited export/view path | ≤ 14 days |
| Correction | Organizer can correct name/contact with a reason; the participant can re-register | ≤ 7 days |
| Deletion | A request removes the registration, attendance record and tokens; consequences are explained (attendance history at the mosque is lost) | ≤ 14 days |
| Withdraw consent | Cancel registration, unsubscribe from notifications, request deletion | immediate for future processing |
| Object to processing | Contact the mosque; the deployment must stop non-essential processing (e.g. disable transcription) | ≤ 30 days |
| Portability | Registration + attendance data exported as CSV on request | ≤ 30 days |

Conflict case (documented because it is unavoidable): a **speaker's** deletion request cannot erase
the mosque's record that a kajian took place, nor a published transcript that the speaker
previously approved. The resolution path: unlist the profile, keep historical event/attendance
records as records (no profile page), and let the speaker unpublish content they own. This is
handled explicitly and recorded (`CONTENT.md` §10, `PRD.md` E15).

## 9. Third-party processors

| Processor | Data | Purpose | Default | Notes |
|---|---|---|---|---|
| Hosting provider | all application data at rest/in transit | run the service | required | region chosen by the operator |
| Object storage provider | audio, exports | store media | required | private buckets, presigned access |
| Email provider | contact, message text | deliver notifications | required for email | **never** tokens (see `NOTIFICATIONS.md` §6) |
| STT provider (hosted) | audio, language hints | transcription | **disabled by default** | enabling is an explicit deployment decision; document region/retention in the deployment runbook |
| OTLP backend | telemetry without personal data | observability | optional | local collector possible |
| Messaging channels (WhatsApp/SMS/Telegram) | contact, message text | notifications | **not in MVP** | requires a DPIA-style review before enabling |

Rule: enabling any new processor requires (a) an update to this table, (b) a note in the deployment
runbook, and (c) a review of the data categories involved. Sending **voice data** to a new processor
additionally requires an ADR.

## 10. Analytics policy

- Aggregate only: counts of views, registrations, check-ins, feedback ratings — per event, per
  mosque, per program.
- **No** individual participant behaviour tracking, no cross-event participant funnels, no
  fingerprinting, no third-party analytics scripts (`FR-ANALYTICS-004`).
- The metrics the product reports are the ones it needs to operate (see `PRD.md` §18), not
  engagement metrics.
- Platform-level analytics must not be able to identify a person from a small cell (min group size
  of 5 for any breakdown).

## 11. Logging and telemetry restrictions

- Never logged: tokens / short codes, contact values, participant names, transcript text, feedback text,
  audio bytes, presigned URLs, provider payloads.
- IP addresses are hashed with a rotating salt when needed for abuse prevention, retained 30 days.
- Correlation ids are opaque and non-personal.
- Log retention is defined and access-restricted (`OBSERVABILITY.md`).

## 12. Security of processing

See `SECURITY.md`. Privacy-relevant highlights: encryption in transit everywhere; encryption at rest
for the database volume and storage buckets `[infra]`; least-privilege DB roles, append-only audit
tables; no production data in development; access to backups restricted and reviewed.

## 13. Breach response (UU PDP: 72 hours)

1. Detect (alert or report) → 2. Contain → 3. Assess whether personal data was involved and how many
data subjects → 4. **Notify** the supervisory authority and affected individuals within 72 hours
where required → 5. Remediate → 6. Document (incident record, updated `THREAT_MODEL.md`, new test).

## 14. Privacy acceptance criteria

1. The registration form contains exactly the fields in §3, and no others (schema test).
2. No participant-level history surface exists for any role (facility test: no endpoint, no page).
3. Anonymous feedback is not linkable to a person (DB constraint test).
4. Deletion removes rows and objects, and produces a policy-keyed deletion record (retention test).
5. Retention jobs are scheduled, idempotent, and audited (job test).
6. Recordings never cross the storage boundary without policy allowing it (signing test).
7. Telemetry contains no personal data (allow-list test + periodic log sample review in
   `OPERATIONS.md`).
8. Every field in the data inventory has a stated purpose and a retention entry (documentation
   lint task).
