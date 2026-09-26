# StrangerLink — Task Register

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ROADMAP.md](ROADMAP.md), [docs/TRACEABILITY.md](docs/TRACEABILITY.md)

> **No task in this register is implemented.** Each entry describes the *eventual* module,
> its constraints, and its planned tests. Task IDs are referenced from skeleton code as
> `Not implemented: T-<ID>`.

---

## Task ID scheme

| Prefix | Domain | Slice |
| --- | --- | --- |
| `T-SESSION-*` | Session identity and lifecycle | VS-1, VS-3 |
| `T-QUEUE-*` | Queue | VS-2 |
| `T-MATCH-*` | Matchmaking | VS-3 |
| `T-CHAT-*` | Text chat | VS-4 |
| `T-SESSION-END-*` | Disconnect and requeue | VS-5 |
| `T-REPORT-*` | Reporting | VS-6 |
| `T-BLOCK-*` | Blocking | VS-6 |
| `T-SAFE-*` | Safety controls | VS-7 |
| `T-BAN-*` | Ban enforcement | VS-7 |
| `T-MOD-*` | Moderation | VS-7, VS-12 |
| `T-SIG-*` | Signaling | VS-8 |
| `T-MEDIA-*` | Media | VS-9, VS-10 |
| `T-TURN-*` | TURN | VS-11 |
| `T-ABUSE-*` | Abuse prevention | VS-13 |
| `T-OBS-*` | Observability | VS-14 |
| `T-SEC-*` | Security | VS-15 |
| `T-PRIV-*` | Privacy | VS-15 |
| `T-RET-*` | Retention | VS-15 |
| `T-A11Y-*` | Accessibility | VS-0 onward |

---

## T-SESSION-001 — Create a pseudonymous participant identity

**Requirements:** FR-ENTRY-004, NFR-PRIV-002
**ADR:** ADR-007, ADR-014
**Design:** DOMAIN.md §2.1, DATA_MODEL.md §3.1
**Goal:** Create a participant identity with no credential and no personal data.

**Important Constraints:**

- must not require any user-supplied personal information
- must generate a `uuidv7` server-side
- must not be linkable to an account, device, or person
- must degrade gracefully when browser storage is unavailable

**Expected Module:** `features/participant`, `domain/participant`

**Tests:** unit tests for identity shape; integration test for storage degradation

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-002 — Age gate and consent enforcement

**Requirements:** FR-ENTRY-001 … FR-ENTRY-010
**ADR:** ADR-014
**Design:** DESIGN.md §4, docs/safety/AGE-GATING.md
**Goal:** Block every chat capability until age and consent are affirmed.

**Important Constraints:**

- both checkboxes unchecked by default
- Continue genuinely disabled until both are checked
- direct navigation to `/queue` and `/chat/[sessionId]` must redirect
- consent versioning must re-prompt on policy change
- must be keyboard operable and screen-reader labelled
- must not claim to verify age

**Expected Module:** `features/safety`, `app/start`

**Tests:** unit tests for gate state; E2E for direct-navigation bypass attempts

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-003 — Enforce the one-active-session invariant

**Requirements:** FR-MATCH-002, INV-1
**ADR:** ADR-007
**Design:** STATE_MACHINE.md §4, §6
**Goal:** Guarantee a participant belongs to at most one active session.

**Important Constraints:**

- must hold under concurrent match attempts
- must handle two browser tabs for one identity (R8)
- must handle a reconnect that supersedes an older socket (R12)
- must be enforced by a single primitive, not scattered checks

**Expected Module:** `domain/session`, `features/session`

**Tests:** "prevents one participant from entering two active sessions"; concurrency tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-004 — Implement the session state machine

**Requirements:** FR-MATCH-010, NFR-SAFE-001
**ADR:** ADR-007
**Design:** STATE_MACHINE.md
**Goal:** Implement the documented transitions and their guards.

**Important Constraints:**

- only documented transitions are permitted (INV-3)
- terminal states are absorbing (INV-4)
- session IDs are never accepted from a client (INV-7)
- every transition emits its documented event
- every race R1–R12 must be resolved

**Expected Module:** `domain/session`, `features/session`

**Tests:** transition table tests; race tests R1–R12

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-QUEUE-011 — Join and cancel the queue

**Requirements:** FR-QUEUE-001 … FR-QUEUE-008
**ADR:** ADR-008
**Design:** MATCHMAKING.md §9, §10
**Goal:** Provide a safe, bounded, cancellable queue.

**Important Constraints:**

- one active ticket per participant
- join is idempotent per participant + queue key
- cancellation is immediate and safe at any instant (R2, R9)
- wait is bounded; expiry offers retry or exit, never automatic requeue
- queue entries are never persisted to PostgreSQL

**Expected Module:** `features/queue`, `domain/matchmaking`

**Tests:** cancellation tests; expiry tests; concurrency tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-QUEUE-012 — Queue rate limiting and cooldown

**Requirements:** FR-QUEUE-008, FR-SAFE-001, FR-SAFE-002
**ADR:** ADR-008, ADR-012
**Design:** ABUSE_PREVENTION.md §2.3, §4
**Goal:** Prevent queue flooding and rapid join/leave abuse.

**Important Constraints:**

- limits are per identity, not per connection
- cooldown is progressive
- cooldown is shown honestly, never disguised as a network error

**Expected Module:** `server/rate-limit`, `features/queue`

**Tests:** rate limit tests; cooldown ladder tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MATCH-021 — Match Two Eligible Participants

**Requirements:** FR-MATCH-001, FR-MATCH-004
**ADR:** ADR-008
**Design:** MATCHMAKING.md, SAFETY.md
**Goal:** Define the eventual service responsible for selecting two eligible queue
participants.

**Important Constraints:**

- do not match blocked participants
- obey age/safety policy
- avoid immediately rematching recent peers
- one active session per participant
- handle queue cancellation safely
- handle concurrent match attempts
- evaluate eligibility at selection time, never from a join-time snapshot
- session creation is atomic: both peers or neither

**Expected Module:** `features/matchmaking`

**Tests:** concurrency tests; eligibility tests; cancellation tests; blocked-peer tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MATCH-022 — Candidate safety constraint evaluation

**Requirements:** FR-MATCH-003, FR-MATCH-011, NFR-SAFE-004
**ADR:** ADR-008, ADR-012
**Design:** MATCHMAKING.md §6, §7
**Goal:** Apply blocks, bans, restrictions, recent peers, and mode compatibility at
candidate selection.

**Important Constraints:**

- ban checks fail closed
- every constraint is evaluated against current state
- a violated constraint rejects the candidate and continues scanning, it does not abort

**Expected Module:** `features/matchmaking`, `domain/matchmaking`

**Tests:** eligibility tests; blocked-peer tests; ban-store-unavailable test

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MATCH-031 — Interest and language preference

**Requirements:** FR-MATCH-007, FR-MATCH-008
**ADR:** ADR-009
**Design:** MATCHMAKING.md §3, §4
**Goal:** Prefer, never guarantee, interest and language overlap.

**Important Constraints:**

- interests come from a closed vocabulary
- interests are never shown to the peer
- bounded preference window with fallback to the general pool
- UI copy must say "try to match", never "will match"

**Expected Module:** `features/matchmaking`

**Tests:** preference fallback tests; vocabulary validation tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-CHAT-001 — Ephemeral text chat relay

**Requirements:** FR-CHAT-001 … FR-CHAT-009
**ADR:** ADR-004, ADR-013
**Design:** CHAT.md, SIGNALING.md §3.3
**Goal:** Relay text messages between two matched peers without persisting them.

**Important Constraints:**

- messages are never written to durable storage
- per-direction monotonic sequencing
- length and rate limits enforced server-side
- links inert; no attachments
- races C1–C6 resolved

**Expected Module:** `features/chat`

**Tests:** ordering tests; rate limit tests; "does not persist message content" test

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-CHAT-002 — Six disconnect states in the UI

**Requirements:** NFR-SAFE-001
**ADR:** ADR-007
**Design:** DESIGN.md §12
**Goal:** Distinguish connection failure, peer disconnect, moderation disconnect, user
block, session timeout, and network issue.

**Important Constraints:**

- never collapse the six states into one generic "disconnected"
- moderation copy never discloses reasoning
- every state offers Leave

**Expected Module:** `features/chat`, `shared/ui`

**Tests:** E2E per state; visual review

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-END-013 — Skip, leave, and exit

**Requirements:** FR-CHAT-009, NFR-SAFE-004
**ADR:** ADR-007
**Design:** DESIGN.md §8, §17
**Goal:** Make leaving possible in one action from every state.

**Important Constraints:**

- no confirmation modal intercepts a deliberate exit
- available in CREATED, WAITING, MATCHED, CONNECTING, ACTIVE
- keyboard operable

**Expected Module:** `features/session`, `app/chat/[sessionId]`

**Tests:** E2E exit-from-every-state

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-END-014 — Requeue with block re-check

**Requirements:** FR-MATCH-005, FR-BLOCK-002
**ADR:** ADR-008, ADR-009
**Design:** MATCHMAKING.md §11
**Goal:** Requeue after a session without rematching blocked or recent peers.

**Important Constraints:**

- blocks re-checked at candidate selection, not at queue join (R5)
- consecutive-requeue cap with an exit offer
- no infinite requeue loop

**Expected Module:** `features/queue`, `features/matchmaking`

**Tests:** "does not immediately rematch blocked participants"; requeue cap tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SESSION-END-015 — WebSocket reconnect and stale session rejection

**Requirements:** NFR-REL-001, EC-08
**ADR:** ADR-003, ADR-004
**Design:** docs/realtime/FAILURE-MODEL.md, STATE_MACHINE.md §7
**Goal:** Recover from transport loss without stranding the user.

**Important Constraints:**

- bounded reconnect window
- stale session IDs rejected (R7)
- reconnect supersedes an older socket (R12)
- limits are per identity, not per connection

**Expected Module:** `features/signaling`

**Tests:** reconnect tests; stale session tests; supersession tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-REPORT-006 — Submit a safety report

**Requirements:** FR-REPORT-001 … FR-REPORT-010
**ADR:** ADR-011
**Design:** docs/safety/REPORTING.md, SAFETY.md §5
**Goal:** Submit a safety report for the current session.

**Safety:** Report submission must remain possible even if the peer disconnects
immediately.

**Important Constraints:**

- one action from any active session state
- opening the report sheet does not end the session; submitting does
- no name, email, phone, or account is collected
- duplicates collapsed on (session, category)
- rate limited
- P0 categories escalate immediately, bypassing normal triage
- the reporter never receives moderation reasoning

**Expected Module:** `features/reports`, `domain/reports`

**Tests:** "accepts a report against a terminal session"; dedup tests; rate limit tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-REPORT-016 — Report credibility weighting

**Requirements:** FR-ABUSE-008
**ADR:** ADR-011
**Design:** ABUSE_PREVENTION.md §9.4
**Goal:** Detect and down-weight report flooding and retaliation.

**Important Constraints:**

- reports are never auto-actioned into a ban
- an identity reporting many distinct peers is down-weighted and flagged, not banned
- weighting is auditable

**Expected Module:** `server/moderation`, `features/reports`

**Tests:** "down-weights reports from an identity reporting many peers"

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-BLOCK-017 — Create a block

**Requirements:** FR-BLOCK-001 … FR-BLOCK-006
**ADR:** ADR-011
**Design:** docs/safety/BLOCKING.md, SAFETY.md §6
**Goal:** Block the current peer and prevent immediate rematch.

**Important Constraints:**

- one confirmation, never two
- no explanation required
- persists across reload within the browser session
- re-checked at candidate selection (R5)
- honest about limits in the UI

**Expected Module:** `features/blocks`

**Tests:** "does not immediately rematch blocked participants"; persistence tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SAFE-052 — Safety event recording and escalation

**Requirements:** FR-SAFE-008, FR-ENTRY-004
**ADR:** ADR-010
**Design:** SAFETY.md §8, MODERATION.md §7
**Goal:** Record safety events and route P0 escalations immediately.

**Important Constraints:**

- P0 bypasses the normal queue entirely
- on-call is paged; acknowledgement latency is measured
- law-enforcement escalation goes through legal counsel, never the on-call engineer
- self-harm content surfaces crisis resources without clinical intervention

**Expected Module:** `features/safety`, `server/moderation`

**Tests:** escalation routing tests; P0 latency metric

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-BAN-051 — Ban enforcement at every entry point

**Requirements:** FR-SAFE-004, FR-MOD-008, NFR-SAFE-004
**ADR:** ADR-012
**Design:** SAFETY.md §13, MATCHMAKING.md §7
**Goal:** Ensure a banned identity cannot participate through any path.

**Important Constraints:**

- checked at queue join, candidate selection, session creation, WebSocket connect, and
  TURN credential mint
- **fails closed** — if the ban store is unreachable, do not match
- a banned user can still submit a report
- a single `BanEnforcementPort` is the only permitted authority

**Expected Module:** `server/moderation`, `features/matchmaking`

**Tests:** "a banned identity is refused at every entry point"; ban-store-unavailable test

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-BAN-052 — Ban evasion detection without fingerprinting

**Requirements:** FR-ABUSE-006
**ADR:** ADR-012
**Design:** ABUSE_PREVENTION.md §8, PRIVACY.md §3.1
**Goal:** Raise the cost of re-entry using signals already held.

**Important Constraints:**

- no device fingerprinting, ever, by default
- a shared-IP signal can only trigger a rate limit or cooldown, never a standalone ban
- no single signal is sufficient; correlation plus human review is required
- any proposal to add fingerprinting requires a privacy impact assessment and a new ADR

**Expected Module:** `server/moderation`, `server/rate-limit`

**Tests:** "a shared-IP signal cannot trigger a standalone ban"

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MOD-041 — Moderation case creation and triage ports

**Requirements:** FR-MOD-001, FR-MOD-002, FR-MOD-006
**ADR:** ADR-010
**Design:** MODERATION.md §3, §7
**Goal:** Create and triage moderation cases.

**Important Constraints:**

- no automated content model in this phase
- moderators see session metadata only — never content or media
- severity is category-driven; P0 routes separately
- "insufficient information" is a legitimate, tracked outcome

**Expected Module:** `features/moderation`, `server/moderation`, `domain/moderation`

**Tests:** case creation tests; severity routing tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MOD-042 — Moderation action, audit, and admin authorization

**Requirements:** FR-MOD-003, FR-MOD-004, FR-MOD-005, NFR-SEC-008
**ADR:** ADR-010, ADR-001
**Design:** MODERATION.md §10, SECURITY.md §12
**Goal:** Apply moderation outcomes with a complete, immutable audit trail.

**Important Constraints:**

- no action without a reason code
- no action without an audit record, written in the same transaction
- admin authorization is server-side on every request, never middleware alone
- individual admin accounts; MFA for enforcement roles
- no self-escalation

**Expected Module:** `server/moderation`, `features/moderation`

**Tests:** "a non-admin cannot reach any admin route"; "a moderator cannot perform an
admin action"; "no action without an audit record"

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SIG-011 — Implement the signaling protocol

**Requirements:** NFR-SEC-002, NFR-SEC-004, NFR-SEC-005
**ADR:** ADR-003, ADR-004
**Design:** SIGNALING.md, docs/realtime/FAILURE-MODEL.md
**Goal:** Implement the session-bound, opaque-payload signaling relay.

**Important Constraints:**

- every frame Zod-validated before dispatch
- `fromParticipantId` must equal the authenticated identity; mismatch closes the connection
  and raises a safety event
- recipient derived server-side; `toParticipantId` forbidden
- `messageId` idempotency; `sequence` monotonicity
- payload size caps
- authentication at the HTTP upgrade handshake, not on the first message
- origin allowlist
- no SDP parsing server-side

**Expected Module:** `features/signaling`, `server/realtime`, `shared/contracts`

**Tests:** impersonation, cross-session, replay, reordering, reconnect, supersession,
rate-limit, payload-cap tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MEDIA-081 — Browser media lifecycle coordinator

**Requirements:** FR-MEDIA-001 … FR-MEDIA-009
**ADR:** ADR-005
**Design:** WEBRTC.md §3
**Goal:** Coordinate getUserMedia and RTCPeerConnection lifecycle.

**Important Constraints:**

- media requires an explicit user gesture
- permission denial never ends the session
- media failure never silently ends the session
- no `MediaRecorder`, no stream capture, no upload path — enforced by lint
- all tracks stopped on session end in every exit path
- mode enforced at match time

**Expected Module:** `features/media`

**Tests:** permission-denied, device-switching, camera-disappears, track-cleanup tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-MEDIA-082 — ICE restart and network-change handling

**Requirements:** NFR-REL-002
**ADR:** ADR-005
**Design:** WEBRTC.md §7, docs/realtime/FAILURE-MODEL.md
**Goal:** Recover media across network changes.

**Important Constraints:**

- at most one automatic restart; a restart loop is worse than a clear failure
- `disconnected` (transient) and `failed` (terminal) are distinguished in the UI
- restart success and failure are both surfaced

**Expected Module:** `features/media`

**Tests:** ICE restart tests; network-switch tests

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-TURN-091 — TURN credential minting and quotas

**Requirements:** NFR-SEC-006, FR-ABUSE-004
**ADR:** ADR-006
**Design:** WEBRTC.md §3.7, ABUSE_PREVENTION.md §9.9
**Goal:** Mint short-lived TURN credentials and enforce allocation quotas.

**Important Constraints:**

- time-limited (minutes), per-session credentials
- minting endpoint authenticated and rate limited
- banned identities refused
- credentials never stored, logged, or placed in a URL
- per-identity and per-server allocation quotas
- relay to private/loopback/link-local/metadata ranges blocked

**Expected Module:** `server/realtime`, `features/media`

**Tests:** credential lifetime test; banned-identity refusal; relay-restriction smoke test

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-ABUSE-061 — Server-side rate limiting

**Requirements:** FR-SAFE-001, FR-ABUSE-001
**ADR:** ADR-003, ADR-012
**Design:** ABUSE_PREVENTION.md §2, SECURITY.md §9
**Goal:** Enforce all documented limits server-side.

**Important Constraints:**

- limits are per identity, not per connection
- every trigger records a `SafetyEvent`
- limits are never weakened for performance (PERFORMANCE.md §8)
- client-side limits are UX affordances only

**Expected Module:** `server/rate-limit`

**Tests:** rate limit tests per limit; "limits are per identity, not per connection"

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-ABUSE-062 — Cooldown ladder and progressive restriction

**Requirements:** FR-SAFE-002, FR-SAFE-005
**ADR:** ADR-012
**Design:** ABUSE_PREVENTION.md §2.3, §7
**Goal:** Apply progressive, proportional restrictions.

**Important Constraints:**

- escalation is progressive and auditable
- cooldowns are shown honestly, never disguised as network errors
- a shared-IP signal can only trigger a rate limit or cooldown

**Expected Module:** `server/rate-limit`, `server/moderation`

**Tests:** cooldown ladder tests; proportionality review

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-OBS-111 — Observability with a no-content policy

**Requirements:** NFR-OBS-001, NFR-OBS-002, NFR-OBS-003
**ADR:** ADR-015
**Design:** OBSERVABILITY.md
**Goal:** Instrument the system without ever capturing content.

**Important Constraints:**

- a shared tracing helper is the only permitted way to create spans
- the attribute allowlist contains no content keys and no address keys
- metric labels are low-cardinality enumerations only
- safety spans are always sampled
- every alert has a runbook entry

**Expected Module:** `server/telemetry`

**Tests:** "the tracing helper rejects disallowed keys"; "the logging helper rejects
disallowed keys"; cardinality lint

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-SEC-071 — Security control implementation and verification

**Requirements:** NFR-SEC-001 … NFR-SEC-008
**ADR:** ADR-001, ADR-004
**Design:** SECURITY.md, THREAT_MODEL.md, docs/security/CONTROLS.md
**Goal:** Implement and verify every documented security control.

**Important Constraints:**

- all SQL behind repository ports; a test asserts no other module imports a driver
- no `dangerouslySetInnerHTML` anywhere (lint)
- `server-only` guard on `src/server/**`
- authorization re-checked server-side in every handler
- strict CSP without `unsafe-inline` / `unsafe-eval`
- secret scanning in CI

**Expected Module:** `server/auth`, `server/db`, `shared/validation`

**Tests:** XSS payload suite; CSRF; SQL injection; IDOR matrix; open redirect; admin
escalation; secret scan

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-PRIV-101 — Privacy controls and disclosure

**Requirements:** NFR-PRIV-001 … NFR-PRIV-006
**ADR:** ADR-014
**Design:** PRIVACY.md
**Goal:** Implement the privacy commitments and their disclosures.

**Important Constraints:**

- the signaling plane never attaches, logs, or relays a peer's network address
- the IP-exposure disclosure renders on the media-mode entry path
- no third-party analytics SDK in the chat surface
- no message-content column may exist in the schema
- data inventory reviewed against every new column

**Expected Module:** `features/safety`, `shared/ui`

**Tests:** "the relayed envelope contains no address fields"; disclosure-renders test;
schema guard

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-RET-131 — Retention job

**Requirements:** NFR-PRIV-005
**ADR:** ADR-013
**Design:** RETENTION.md
**Goal:** Enforce the retention schedule.

**Important Constraints:**

- idempotent, logged, and **alerts on failure**
- a failed run is treated as a privacy incident
- verification tests assert expired rows are gone
- scheduled for VS-15 — a retention job before there is data is untestable

**Expected Module:** `server/db`

**Tests:** retention tests per tier; failure-alert drill

**Implementation:** NOT PART OF CURRENT PHASE

---

## T-A11Y-121 — Accessibility implementation and verification

**Requirements:** NFR-A11Y-001 … NFR-A11Y-005
**ADR:** —
**Design:** ACCESSIBILITY.md, DESIGN.md §18
**Goal:** Deliver a WCAG 2.2 AA experience.

**Important Constraints:**

- report and block reachable by keyboard without traversing the message list
- every session state change announced
- touch targets ≥ 44 px; critical controls ≥ 56 px
- focus management on every route change and modal
- zero critical axe violations is the CI gate

**Expected Module:** `shared/ui`, `app/**`

**Tests:** axe scan; keyboard-only walkthrough; screen reader walkthrough; contrast;
reduced motion

**Implementation:** NOT PART OF CURRENT PHASE

---

## Task count

| Domain | Tasks |
| --- | --- |
| Session | 4 |
| Queue | 2 |
| Matchmaking | 3 |
| Chat | 2 |
| Disconnect / requeue | 3 |
| Reports | 2 |
| Blocks | 1 |
| Safety | 1 |
| Bans | 2 |
| Moderation | 2 |
| Signaling | 1 |
| Media | 2 |
| TURN | 1 |
| Abuse prevention | 2 |
| Observability | 1 |
| Security | 1 |
| Privacy | 1 |
| Retention | 1 |
| Accessibility | 1 |
| **Total** | **33** |
