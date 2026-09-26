# THREAT MODEL

Method: STRIDE-flavoured, asset-driven. Each threat names a **boundary**, an **actor**, a
**scenario**, **impact**, **likelihood**, a **planned mitigation**, its **verification**, the
**requirement** it serves, and the **task** that implements it (`TASKS.md`).

Scope note: this is a *product* threat model (what we promise to protect), not an infrastructure
pen-test report. Infrastructure-specific items are marked `[infra]` and owned by the operator.

---

## 1. Assets

| # | Asset | Why an attacker wants it | Impact if compromised |
|---|---|---|---|
| A1 | Check-in tokens (registration → attendance) | Forge or duplicate attendance; annoy an organizer; disrupt an event | Attendance integrity loss; trust damage |
| A2 | Participant contact data (name, WhatsApp/email) | Spam, harassment, doxxing of jamaah | Privacy harm; UU PDP exposure |
| A3 | Attendance records | Reveal who attends which religious gathering (sensitive inference) | Serious privacy harm (religious association) |
| A4 | Voice recordings and transcripts | Redistribution out of context; misquoting a speaker | Content-integrity harm; speaker trust |
| A5 | Organizer/admin accounts | Full tenant compromise; content takedown/mispublication | Wide blast radius |
| A6 | Content ownership/publication authority | Publishing unreviewed or altered religious text | Ethical/religious harm; reputational |
| A7 | Feedback (incl. anonymity guarantee) | De-anonymising critics; silencing | Trust destruction |
| A8 | Audit log | Covering tracks | Accountability loss |
| A9 | Tenant isolation | Cross-mosque data access | Multi-tenant breach |
| A10 | Availability of check-in at the entrance | Denial during an event | Operational failure in front of a crowd |

## 2. Trust boundaries

```
 B1  Internet → web app          (untrusted input)
 B2  Client browser ↔ server     (all client claims untrusted; capabilities are credentials)
 B3  Server ↔ PostgreSQL         (trusted, but constraints are part of security)
 B4  Server ↔ object storage     (trusted store; presigned URLs are bearer credentials)
 B5  Server ↔ STT provider       (third party; voice data boundary) 
 B6  Server ↔ email provider     (third party; contact data boundary)
 B7  Worker ↔ media parsers      (hostile input processing: ffmpeg)
 B8  Operator device ↔ entrance  (shared physical device; shoulder surfing)
 B9  Platform admin ↔ participant data (privileged access boundary)
 B10 Backup/export artefacts ↔ operator (contain personal data at rest)
```

## 3. Threats

### T-01 · QR contains PII / database ids
- **Boundary:** B2 · **Actor:** curious participant / screenshot sharer
- **Scenario:** the QR encodes name/phone/registration id; a screenshot in a family WhatsApp group
  leaks personal data, or an attacker enumerates ids.
- **Impact:** privacy breach (A2), enumeration (A1) · **Likelihood:** high if designed naively
- **Mitigation:** opaque 128-bit token only; no PII, no UUIDs; server-side lookup by hash (ADR-0006)
- **Verification:** unit test on payload shape; security test that no entity id appears
- **Requirement:** FR-CHECKIN-011, NFR-SEC-005 · **Task:** T-CHECKIN-003

### T-02 · Token forgery / guessing
- **Boundary:** B1 · **Actor:** external attacker
- **Scenario:** brute-force or predict token values to create attendance or discover registrations.
- **Impact:** integrity, enumeration · **Likelihood:** low (128-bit entropy) but must be bounded
- **Mitigation:** CSPRNG 128-bit tokens; SHA-256 at rest; constant-time compare; rate limits per
  device/IP; failure metrics with alerting; no error message that distinguishes "unknown" from
  "wrong event" beyond the operator's needs
- **Verification:** statistical test (no collisions/patterns), rate-limit test, alert test
- **Requirement:** NFR-SEC-004, FR-CHECKIN-005 · **Task:** T-CHECKIN-011

### T-03 · Token replay / screenshot forwarding
- **Boundary:** B8 + B2 · **Actor:** opportunistic attendee, family member
- **Scenario:** a participant forwards their QR to a relative who is not registered; or the same
  screenshot is scanned twice at two entrances.
- **Impact:** attendance integrity (A1), reporting distortion · **Likelihood:** medium (documented
  residual risk)
- **Mitigation:** single-use semantics (first scan wins; later scans are `ALREADY_CHECKED_IN`);
  duplicate-scan metrics per event; `DUPLICATE_SCAN_RATE_HIGH` alert; re-issue/revocation path;
  organizers may switch an event to attended-manual verification if abuse is observed
- **Verification:** concurrency test C2; alert test with synthetic duplicates; documented residual
  risk in `docs/security/QR-SECURITY.md`
- **Requirement:** FR-CHECKIN-004/013 · **Task:** T-CHECKIN-014, T-CHECKIN-018

### T-04 · Duplicate attendance from concurrent scanners
- **Boundary:** B3 · **Actor:** accident (two volunteers, retrying network)
- **Scenario:** two devices scan the same token simultaneously; both insert.
- **Impact:** attendance integrity (A1) · **Likelihood:** medium without controls
- **Mitigation:** unique constraint + `ON CONFLICT DO NOTHING` + idempotency keys (ADR-0025)
- **Verification:** concurrency test C2 with N parallel requests; exactly one record
- **Requirement:** FR-CHECKIN-009, NFR-REL-003 · **Task:** T-CHECKIN-014

### T-05 · Wrong-event check-in (operator error)
- **Boundary:** B8 · **Actor:** volunteer with two events at one mosque
- **Scenario:** the device is open on yesterday's event; attendance lands in the wrong event.
- **Impact:** records wrong; reporting wrong · **Likelihood:** medium
- **Mitigation:** device binding to one event/venue with a persistent context bar; wrong-event tokens
  rejected explicitly; rebinding requires an explicit, warned, audited action; anomaly alert if a
  device's scans span two events
- **Verification:** UX test at the entrance; integration test for `WRONG_EVENT`; alert test
- **Requirement:** FR-CHECKIN-002/005 · **Task:** T-CHECKIN-006

### T-06 · Registration abuse / mass fake registrations
- **Boundary:** B1 · **Actor:** spammer, prankster
- **Scenario:** hundreds of fake registrations consume capacity, blocking real attendees.
- **Impact:** availability of seats, organizer workload · **Likelihood:** medium for open public
  events with a shareable link
- **Mitigation:** rate limits per contact and IP; capacity caps; organizer can close registration and
  switch to invitation mode; capacity-limited events show the waitlist instead of failing silently;
  no monetary value to fake, so motivation is low
- **Verification:** rate-limit test; scenario in `QA.md` §Abuse
- **Requirement:** FR-REG-004, NFR-SEC-010 · **Task:** T-REG-009

### T-07 · Contact-detail harvesting
- **Boundary:** B1/B8 · **Actor:** external attacker, malicious volunteer
- **Scenario:** enumerate registrations to harvest phone numbers (e.g. by guessing event ids and
  contacting participants), or a volunteer exports the list for their own use.
- **Impact:** privacy (A2) · **Likelihood:** medium
- **Mitigation:** registration lists are event-scoped and authenticated; operator search shows at
  most 10 results with masked contacts; exports require role + reason + audit; no bulk contact list
  in any UI; no public "participant list"
- **Verification:** isolation tests, export audit test, UI assertion that contacts are masked
- **Requirement:** FR-ATTEND-005, NFR-PRIV-001 · **Task:** T-REG-011, T-ATTEND-006

### T-08 · Cross-tenant access (IDOR/BOLA)
- **Boundary:** B1 → B3 · **Actor:** authenticated organizer of another mosque/tenant
- **Scenario:** change an id in a request and read/modify another organization's event, transcript
  or feedback.
- **Impact:** major multi-tenant breach (A9, A3, A4) · **Likelihood:** medium (classic bug)
- **Mitigation:** `TenantScope` typed repositories, composite FKs, RLS backstop, 404-not-403,
  enumerated isolation test suite (ADR-0017)
- **Verification:** isolation suite in CI (every route), RLS test that removes the WHERE clause
- **Requirement:** FR-ORG-003, NFR-SEC-003 · **Task:** T-SEC-001

### T-09 · Privilege escalation (member → admin)
- **Boundary:** B1 · **Actor:** authenticated organizer
- **Scenario:** grant self `PLATFORM_ADMIN`, or widen mosque scope to reach another mosque.
- **Impact:** wide compromise (A5) · **Likelihood:** medium if unguarded
- **Mitigation:** no self-grant; cannot grant beyond own authority; role changes audited; platform
  roles only by platform admins; session re-issued on privilege change
- **Verification:** escalation test suite; audit assertions
- **Requirement:** FR-ORG-002, NFR-SEC-002 · **Task:** T-SEC-002

### T-10 · Malicious/oversized audio upload
- **Boundary:** B7 · **Actor:** authenticated operator or a stolen session
- **Scenario:** upload crafted media to exploit the parser (ffmpeg), or fill storage.
- **Impact:** worker compromise (RCE), storage exhaustion, cost · **Likelihood:** low–medium
- **Mitigation:** size caps per chunk and session; magic-byte sniffing; ffmpeg pinned and sandboxed
  with CPU/memory/time limits and no network; keys derived from ids (no user filenames); quotas per
  organization; alerts on abnormal growth; no media parsing in the web process
- **Verification:** fuzz-style corpus test (malformed container files rejected), resource-limit test,
  quota test
- **Requirement:** NFR-SEC-009 · **Task:** T-AUDIO-004, T-SEC-005

### T-11 · Unauthorised access to recordings
- **Boundary:** B4 · **Actor:** authenticated user outside the permitted scope; leaked URL
- **Scenario:** guess a storage key, or reuse a copied presigned URL after unpublishing.
- **Impact:** content/privacy breach (A4) · **Likelihood:** medium
- **Mitigation:** private buckets; keys contain opaque ids; presigned URLs short-lived (≤ 15 min) and
  issued only after an authorization decision; policy checks at signing time (`INTERNAL` never
  signs for non-organizers); cache-control `private, no-store`
- **Verification:** signing-denial tests per policy; expiry test; test that unpublished assets are
  refused
- **Requirement:** FR-AUDIO-011, FR-CONTENT-007 · **Task:** T-AUDIO-008

### T-12 · Stolen operator session at the entrance
- **Boundary:** B8 · **Actor:** thief / prankster with a borrowed device
- **Scenario:** a phone left on the check-in screen is used to check in arbitrary people.
- **Impact:** attendance integrity (A1) · **Likelihood:** medium in a crowd
- **Mitigation:** device binding limits damage to one event; every check-in records operator +
  device label; short idle lock on the check-in screen (configurable, default 30 min) with quick
  re-auth; manual methods recorded and visible in reports; anomaly alerts (burst of manual scans)
- **Verification:** idle-lock test; audit completeness test
- **Requirement:** FR-CHECKIN-014, NFR-SEC-001 · **Task:** T-CHECKIN-016

### T-13 · Transcript information leakage (unpublished text)
- **Boundary:** B1 · **Actor:** external, or a reviewer sharing drafts
- **Scenario:** drafts expose a speaker's unverified words; search indexes drafts; a share link
  leaks a draft.
- **Impact:** content integrity, speaker trust (A4/A6) · **Likelihood:** medium
- **Mitigation:** drafts are `EVENT`-scoped with `no-store`; search indexes only published revisions;
  public transcript route serves `published_revision_id` only; no "share draft" feature; the API
  never returns drafts to non-reviewers
- **Verification:** public-surface tests; search exclusion test; cache-header assertion
- **Requirement:** FR-TRANSCRIPT-006/010, FR-CONTENT-007 · **Task:** T-TRANSCRIPT-012

### T-14 · Misquoting a speaker via machine text
- **Boundary:** product-level (no external actor required)
- **Actor:** the system itself
- **Scenario:** an unreviewed or auto-"corrected" transcript attributes words to a speaker.
- **Impact:** religious/content integrity (A6) · **Likelihood:** high if the gate is relaxed
- **Mitigation:** mandatory human approval; DB constraint `published_at ⇒ approved_by`; provenance
  labels everywhere; certainty flags preserved; no automatic Arabic correction; machine draft kept
  as revision 1 for audit (ADR-0012, ADR-0023)
- **Verification:** constraint tests, UI label tests, review workflow tests
- **Requirement:** FR-TRANSCRIPT-006/008/010, NFR-ETH-002 · **Task:** T-TRANSCRIPT-014

### T-15 · De-anonymisation of feedback
- **Boundary:** B3 + B9 · **Actor:** organizer or admin attempting to identify a critic
- **Scenario:** correlate submission time with attendance time; look up the registration; join
  tables.
- **Impact:** trust destruction (A7); privacy harm · **Likelihood:** medium if anonymity is
  implemented as a flag rather than as data absence
- **Mitigation:** anonymous rows have **no** participant reference (DB check); day-granularity
  timestamps for anonymous submissions; aggregates with n < 5 suppressed; no UI path to link;
  audit shows no actor for anonymous submissions
- **Verification:** schema constraint test; attempted-join test; small-sample test
- **Requirement:** FR-FEEDBACK-003, NFR-PRIV-005 · **Task:** T-FEEDBACK-004

### T-16 · Feedback abuse / harassment of a speaker
- **Boundary:** B1/B2 · **Actor:** participant, or a coordinated group
- **Scenario:** comments used to insult a speaker or push a theological agenda.
- **Impact:** harm to a person; content pollution · **Likelihood:** medium
- **Mitigation:** one request per person per event; scope-restricted comment field; reporting and
  hiding with audit; no public display; no comparative view; rate limits on anonymous submissions
- **Verification:** reporting workflow test; rate-limit test
- **Requirement:** FR-FEEDBACK-006 · **Task:** T-FEEDBACK-006

### T-17 · Audit-log tampering
- **Boundary:** B3/B9 · **Actor:** insider, compromised admin
- **Scenario:** delete or alter audit rows to hide an action.
- **Impact:** accountability loss (A8) · **Likelihood:** low but catastrophic
- **Mitigation:** append-only tables with no update/delete grants for the app role; separate role for
  retention; backups; hash-chaining (P1) with verification job; retention runs are themselves
  audited
- **Verification:** permission test (update/delete fails); chain verification job test
- **Requirement:** FR-AUDIT-001, NFR-SEC-002 · **Task:** T-SEC-007

### T-18 · Secret leakage in logs/telemetry
- **Boundary:** B3 → operator tooling · **Actor:** accident
- **Scenario:** a token or contact detail lands in application logs and is shipped to a log store.
- **Impact:** credential/privacy breach (A1/A2) · **Likelihood:** medium without controls
- **Mitigation:** allow-list logger; `telemetry_dropped_attribute_total` counter; lint rule banning
  logging token fields; review checklist; no request-body logging
- **Verification:** unit test on the allow-list; log-scrub test in integration
- **Requirement:** NFR-PRIV-006, NFR-OBS-002 · **Task:** T-OBS-002

### T-19 · Third-party STT provider exposure
- **Boundary:** B5 · **Actor:** the platform itself (via configuration)
- **Scenario:** recordings are sent to a hosted provider without a decision, or retained by the
  vendor beyond need.
- **Impact:** privacy (A4), jurisdictional exposure · **Likelihood:** medium (defaults matter)
- **Mitigation:** self-hosted provider is the default; hosted adapters require an explicit,
  documented configuration flag; provider list documented in `PRIVACY.md` with purpose/region; raw
  provider payload retention 30 days; no training opt-in; a deployment can disable transcription
  entirely (`policy: NONE`)
- **Verification:** configuration test (hosted provider disabled by default); documentation review
- **Requirement:** FR-TRANSCRIPT-003, NFR-PRIV-007 · **Task:** T-TRANSCRIPT-005

### T-20 · Notification channel leakage
- **Boundary:** B6 · **Actor:** shared devices, forwarded messages
- **Scenario:** a QR/token sent over a channel that is not access-controlled is forwarded or read by
  others.
- **Impact:** attendance integrity (A1), privacy (A2) · **Likelihood:** medium
- **Mitigation:** tokens only in in-app/email (single-recipient); short exchange codes for other
  channels; templates cannot render token fields for uncontrolled channels; no token in subject
  lines or SMS previews
- **Verification:** template rendering test per channel; code review rule
- **Requirement:** FR-NOTIF-010 · **Task:** T-NOTIF-004

### T-21 · Denial of service at the entrance
- **Boundary:** B1/B3 · **Actor:** external attacker or coincidental load
- **Scenario:** someone targets the check-in API during a large event, or a retry storm from many
  devices overwhelms it.
- **Impact:** queue stalls (A10) · **Likelihood:** low–medium
- **Mitigation:** rate limits per device/IP with generous ceilings for legitimate bursts; validation
  path is a single indexed lookup with no queueing; graceful degradation with clear "belum tercatat"
  state; manual fallback operational procedure; alert `CHECKIN_FAILURE_RATE_HIGH`
- **Verification:** load test at 3× target throughput; alert test; manual fallback drill in `QA.md`
- **Requirement:** NFR-PERF-004, NFR-REL-006 · **Task:** T-PERF-002, T-OPS-004

### T-22 · Backup/export exfiltration
- **Boundary:** B10 · **Actor:** insider, stolen laptop
- **Scenario:** a database dump or CSV export containing contacts and attendance is copied.
- **Impact:** mass privacy breach (A2/A3) · **Likelihood:** low–medium
- **Mitigation:** exports are short-lived and audited; backups encrypted at rest with restricted
  access; no production data in development; documented restore procedure with access logging
  `[infra]`
- **Verification:** expiry test; backup access review in `OPERATIONS.md`
- **Requirement:** NFR-OPS-002, NFR-PRIV-009 · **Task:** T-OPS-006

### T-23 · Malicious content in materials/links
- **Boundary:** B1 · **Actor:** organizer account compromise
- **Scenario:** a link in materials points to malware or an unrelated agenda.
- **Impact:** participant harm, platform reputation · **Likelihood:** low
- **Mitigation:** materials are references with a visible domain; no iframes/embeds; link labels
  moderated on report; no file hosting by us
- **Verification:** rendering test (no embed, domain visible); moderation path test
- **Requirement:** FR-CONTENT-003, FR-MOD-001 · **Task:** T-CONTENT-003

### T-24 · Recording without notice / consent confusion
- **Boundary:** product + physical space
- **Actor:** organizer (benignly) or operator
- **Scenario:** recording starts at an event whose policy is unclear or whose participants were not
  informed; participants are surprised by publication.
- **Impact:** privacy harm (A4), trust · **Likelihood:** medium
- **Mitigation:** policy is explicit at publish time and snapshotted at recording start; the
  participant-facing page states it before the event; the operator sees it before starting; changing
  policy mid-session requires acknowledgement; `INTERNAL` publication is blocked at the signing
  layer; organizers are given notice text to read aloud (operational guidance)
- **Verification:** policy snapshot test; UI statement test; publication-blocked test
- **Requirement:** FR-AUDIO-013, NFR-PRIV-003 · **Task:** T-AUDIO-002

## 4. Residual risks (accepted, documented, monitored)

| Risk | Why accepted | Monitoring |
|---|---|---|
| Forwarded/screenshot QR grants one attendance record | No identity verification exists; the alternative (photo capture, device binding per participant) harms accessibility and privacy far more | duplicate-scan rate metric per event + alert |
| A copied presigned URL works until expiry (≤ 15 min) | Short-lived bearer capability is the standard trade-off | audit of signing requests; unusual download rates alert |
| Volunteer devices may be compromised | Cannot control volunteers' phones; controls limit blast radius to one event | device label in audit; anomaly detection |
| Hosted STT (if enabled) sees audio | Explicitly configured, documented choice by the deployment | configuration review; provider retention noted in `PRIVACY.md` |
| Shared phone/contact identity collapses two people into one registration | Respects data minimisation; asking for more identifiers is worse | documented in `REGISTRATION.md` §11; organizers can use participantCount |

## 5. Threat-model maintenance

1. Every incident (`docs/security/INCIDENT-RESPONSE.md`) adds or updates a threat here.
2. Every new boundary (new third-party service, new client capability) requires a threat review in
   the PR that introduces it — and an ADR if it needs a decision.
3. Vertical slices VS-4 (check-in), VS-7/8 (audio), VS-9/10 (transcription/content) and VS-13
   (hardening) each re-read this document; VS-13 verifies every mitigation marked as a task and
   closes the ones that are implemented, recording evidence in `docs/architecture/FINAL-REVIEW.md`.
