# StrangerLink — Product Requirements Document

- **Status:** Architecture phase (documentation only)
- **Version:** 0.1.0
- **Owner:** Product / Architecture
- **Last updated:** 2026-09-26
- **Scope of this document:** Requirements and acceptance criteria. **No implementation
  exists.** See [AGENTS.md](AGENTS.md) before writing code against these requirements.

---

## 1. Problem

People want to have short, low-commitment conversations with strangers — to practise a
language, to meet someone outside their social graph, to pass time, to get a second
opinion, or simply out of curiosity. Existing options force a choice between:

- **Heavyweight social platforms** that require identity, a profile, followers, and
  permanent social graph — the opposite of a low-friction stranger conversation; and
- **Legacy anonymous chat sites** that treat safety as an afterthought, producing an
  experience dominated by nudity, harassment, bots, and scams.

The gap: **a stranger chat product where the friction of entry is low but the safety
posture is deliberately, visibly, and non-negotiably strong.**

StrangerLink is that product. Anonymity is preserved *for the user's benefit*, not as a
shield for abusers.

---

## 2. Goals

| ID | Goal | Measure of success |
| --- | --- | --- |
| G-1 | Zero-friction entry: a new user reaches a matched stranger in under 30 seconds without an account, email, or phone number | Median time from landing to matched < 30s |
| G-2 | Text-first reliability: the core loop (queue → match → chat → skip) is dependable on mobile networks | > 99% of matched sessions reach `ACTIVE` |
| G-3 | Safety is reachable in one action from anywhere in a session | Report and Block always visible in session, one tap, no navigation |
| G-4 | Abuse is reduced proportionally, not by banning everyone | Report rate per 1,000 sessions trending down; false-positive ban appeal rate < 5% |
| G-5 | Privacy by default: no public profile, no persistent identity required, no unnecessary personal data collected | Data inventory contains zero unnecessary PII fields |
| G-6 | Accessibility parity: full WCAG 2.2 AA experience for keyboard and screen reader users | Zero critical a11y violations in CI |
| G-7 | Operable by a small team | Single engineer can run production on-call; documented runbooks |

## 3. Non-goals

Explicitly **out of scope**. These must not be designed in, however tempting.

| ID | Non-goal | Rationale |
| --- | --- | --- |
| NG-1 | Public profiles, usernames, follower counts, or popularity scores | Creates identity pressure, popularity dynamics, and stalking surface |
| NG-2 | Persistent chat history / archiving of random conversations | Minimises harm from leaks and reduces data liability; see RETENTION.md |
| NG-3 | File, image, or video attachments in chat | Primary vector for illegal content and CSAM; MVP is text-only |
| NG-4 | Account requirement (email, phone, OAuth) to start chatting | Friction; anonymity. Age gate is a self-attestation + enforcement layer, not an account |
| NG-5 | Perfect or fully automated moderation | Not achievable; see SAFETY.md "Limitations we will not hide" |
| NG-6 | End-to-end encryption claims | Misleading in an anonymous P2P product; we make no E2EE claim |
| NG-7 | Gamification: streaks, badges, engagement rewards, infinite requeue loops | Addictive dark patterns; see DESIGN.md |
| NG-8 | Push notifications | No persistent identity to notify; out of scope |
| NG-9 | Group chat, rooms, or broadcast | Expands abuse surface 10×; pairwise only |
| NG-10 | Monetisation of attention | Not in this phase |
| NG-11 | Native mobile apps | Web-only, mobile-first |
| NG-12 | Region/language-based *content* localisation beyond matching constraints | Scope control |

---

## 4. Target users

| Persona | Description | Needs | Anti-needs |
| --- | --- | --- | --- |
| **The Curious** (primary) | 18–34, wants a quick conversation, may leave in 10 seconds | Instant match, easy exit, no signup | Being trapped, being recognised |
| **The Language Learner** | Wants to practise with a native speaker | Interest/language matching, text chat | Video by default, judgement |
| **The Bored Commuter** | Mobile, flaky network, one-handed | Fast mobile UI, low data, clear error states | Heavy UI, forced camera |
| **The Moderator** | Trust & Safety operator | Clear report triage queue, audit trail, fast enforcement | Vague reports, no context |
| **The On-call Engineer** | Runs the system | Metrics, runbooks, kill switches | Noisy dashboards, silent failures |
| **The Abuser** (adversary) | Wants to harass, expose, scam, or distribute illegal content | — | Everything above is designed against them |

**Primary region for launch:** Indonesia + global English. Region constraints are a
matching input, not a hard geo-fence (see MATCHMAKING.md).

---

## 5. Age requirements

| ID | Requirement |
| --- | --- |
| FR-ENTRY-001 | The product is **18+ only**. No exceptions. |
| FR-ENTRY-002 | Before any queue entry or chat UI, the user must pass an **age gate** that requires an affirmative act (not a pre-checked box, not a passive "enter" button). |
| FR-ENTRY-003 | The age gate must state, in plain language, that the service is for adults, that conversations are unmoderated in real time, and that the user may encounter offensive content. |
| FR-ENTRY-004 | The age attestation is a **self-declaration**, not identity verification. It is recorded as a safety event, not as personal data. |
| FR-ENTRY-005 | No chat, queue, or media capability is reachable before FR-ENTRY-002 is satisfied, including via direct URL navigation to `/queue` or `/chat/[sessionId]`. |
| FR-ENTRY-006 | If a minor is discovered in a session, the session is terminated immediately and the identity is restricted. See [docs/safety/MINORS.md](docs/safety/MINORS.md). |
| FR-ENTRY-007 | Age gate UI must be keyboard operable and screen-reader labelled. |

**Honest limitation:** self-attestation does not prove age. It raises the cost of
participation and creates a defensible record. Stronger age assurance is a PLANNED
option, not a SELECTED one — see [docs/research/STACK-2026.md](docs/research/STACK-2026.md).

---

## 6. Chat modes

| Mode | ID | Description | Availability |
| --- | --- | --- | --- |
| **Text** | FR-CHAT-001 | Ephemeral text messages between two matched peers | MVP (VS-4) |
| **Text + Audio** | FR-MEDIA-001 | Adds one-way-initially optional microphone audio | Phase 2 (VS-9) |
| **Text + Audio + Video** | FR-MEDIA-002 | Adds camera video, both parties opt in per session | Phase 3 (VS-10) |

Rules that apply to all modes:

- The user selects the mode **before** joining the queue. Mode is part of the match
  request; a text-only user is never matched with a video-mode user.
- Media is **off by default**. Camera/microphone require an explicit user gesture.
- Media mode can be **downgraded** mid-session by either peer (turn camera off) without
  ending the session.
- Either peer can end the session at any time, for any reason, with one action.

---

## 7. User journeys

Detailed step-by-step journeys with edge cases: [docs/product/JOURNEYS.md](docs/product/JOURNEYS.md).

### 7.1 Happy path (text)

1. User lands on `/`.
2. User taps **Start**.
3. Age gate + safety notice presented → user affirms 18+ and acknowledges.
4. User selects **Text** mode.
5. User optionally enters interests / language (skippable).
6. User taps **Find a stranger** → enters queue.
7. Queue state shown with elapsed time and a visible **Cancel** action.
8. Match found → session created → `CONNECTING` → `ACTIVE`.
9. Users exchange text.
10. User taps **Skip** → session ends → user is offered a new match or exit.
11. User exits.

### 7.2 Report path

1. During an active session, the user taps **Report**.
2. A report sheet opens **without ending the session**.
3. User selects a category (and optionally a note).
4. User submits → report recorded → peer session is ended.
5. User is shown a confirmation that the report was received, and is **not** shown
   confidential moderation reasoning.
6. User can continue (new match) or exit.

### 7.3 Block path

1. During an active session, the user taps **Block**.
2. Block is confirmed with one additional tap.
3. Peer is prevented from rematching with this user for the configured window.
4. Session ends immediately.
5. User can continue or exit.

### 7.4 Exit path (must always work)

From **any** state — queue, matched, connecting, active — a single always-visible
control returns the user to a clean exit. There is no confirmation trap, no
"are you sure you want to leave?" modal that hides the exit, and no streak or reward
that penalises leaving.

---

## 8. Functional requirements

### 8.1 Entry and consent

| ID | Requirement |
| --- | --- |
| FR-ENTRY-001 | Service is 18+ only |
| FR-ENTRY-002 | Affirmative age gate before any chat capability |
| FR-ENTRY-003 | Age gate states adult nature + unmoderated-in-real-time disclaimer |
| FR-ENTRY-004 | Age attestation recorded as a safety event |
| FR-ENTRY-005 | No chat reachable before age gate, including direct URL navigation |
| FR-ENTRY-006 | Minor discovered in session → immediate termination + restriction |
| FR-ENTRY-007 | Age gate is keyboard operable and screen-reader labelled |
| FR-ENTRY-008 | Consent to ephemeral chat, no-recording, and no-attachments is presented and acknowledged |
| FR-ENTRY-009 | Consent acknowledgement is versioned (`consentVersion`) so policy changes re-prompt |
| FR-ENTRY-010 | Age/consent state is stored client-side only and is re-requested per browser session |

### 8.2 Queue

| ID | Requirement |
| --- | --- |
| FR-QUEUE-001 | A participant may join exactly one queue at a time |
| FR-QUEUE-002 | A participant may cancel the queue at any time, with immediate effect |
| FR-QUEUE-003 | Queue join is idempotent per participant + queue key |
| FR-QUEUE-004 | Queue entry records: mode, interests, language, region constraint, eligibility snapshot |
| FR-QUEUE-005 | Queue position / wait time is surfaced to the user |
| FR-QUEUE-006 | Queue wait has a maximum bounded duration; on expiry the user is offered retry or exit |
| FR-QUEUE-007 | Leaving the queue while being matched must be safe (no orphaned match) |
| FR-QUEUE-008 | Queue join is rate limited and has a cooldown after rapid join/leave cycles |

### 8.3 Matchmaking

| ID | Requirement |
| --- | --- |
| FR-MATCH-001 | Two eligible waiting participants are paired into one session |
| FR-MATCH-002 | A participant may belong to at most one active session |
| FR-MATCH-003 | Participants with an active block relationship are never matched |
| FR-MATCH-004 | A participant who has left the queue is never matched |
| FR-MATCH-005 | Recently-matched peers are not immediately rematched (recent-peer avoidance window) |
| FR-MATCH-006 | Match mode must be compatible on both sides |
| FR-MATCH-007 | Interest matching is a preference, never a guarantee; fall back to random |
| FR-MATCH-008 | Language matching is a preference, never a guarantee |
| FR-MATCH-009 | Concurrent match attempts for the same participant resolve to exactly one session |
| FR-MATCH-010 | Match creation is atomic — either both peers get the session or neither does |
| FR-MATCH-011 | Banned or restricted participants are not matched |
| FR-MATCH-012 | Match cancellation races leave no dangling queue entries |

### 8.4 Text chat

| ID | Requirement |
| --- | --- |
| FR-CHAT-001 | Ephemeral text messages between two matched peers |
| FR-CHAT-002 | Messages are ordered per session by a monotonic sequence number |
| FR-CHAT-003 | Message length is bounded (see PERFORMANCE.md budget: 2000 characters) |
| FR-CHAT-004 | Messages are rate limited per participant per session |
| FR-CHAT-005 | Links are rendered inert by default and are never auto-fetched by the client |
| FR-CHAT-006 | Attachments and file uploads are **not supported** |
| FR-CHAT-007 | On peer disconnect, the UI states clearly that the peer left and does not fabricate delivery |
| FR-CHAT-008 | Message content is not written to durable storage (see RETENTION.md) |
| FR-CHAT-009 | A participant can always leave the session in one action |

### 8.5 Media (audio/video)

| ID | Requirement |
| --- | --- |
| FR-MEDIA-001 | Audio mode available as an opt-in mode |
| FR-MEDIA-002 | Video mode available as an opt-in mode |
| FR-MEDIA-003 | Camera and microphone access requires an explicit user gesture |
| FR-MEDIA-004 | Denied permissions produce a specific, recoverable error state (see DESIGN.md) |
| FR-MEDIA-005 | Either peer can disable their own camera/mic at any time without ending the session |
| FR-MEDIA-006 | Device switching (camera/mic selection) is supported where the browser exposes it |
| FR-MEDIA-007 | Media setup failure never silently ends the session — the user is told what failed |
| FR-MEDIA-008 | No server-side recording of media is ever performed |
| FR-MEDIA-009 | Media mode is enforced at match time, not negotiated after |

### 8.6 Reporting

| ID | Requirement |
| --- | --- |
| FR-REPORT-001 | A participant can submit a safety report from within an active session |
| FR-REPORT-002 | Report submission remains possible after the peer has disconnected |
| FR-REPORT-003 | Report categories are fixed and enumerated (see [docs/safety/REPORTING.md](docs/safety/REPORTING.md)) |
| FR-REPORT-004 | A report captures: session id, reporter session identity, peer session identity, category, timestamp, optional note |
| FR-REPORT-005 | A report does **not** require or collect name, email, phone, or account |
| FR-REPORT-006 | Duplicate reports for the same session+category are collapsed |
| FR-REPORT-007 | Report submission is rate limited to prevent report flooding |
| FR-REPORT-008 | Submitting a report ends the session and offers requeue or exit |
| FR-REPORT-009 | The reporter receives acknowledgement but never confidential moderation reasoning |
| FR-REPORT-010 | Reports referencing a minor are escalated to the highest priority queue immediately |

### 8.7 Blocking

| ID | Requirement |
| --- | --- |
| FR-BLOCK-001 | A participant can block the current peer from within the session |
| FR-BLOCK-002 | A block prevents immediate rematch for a defined window |
| FR-BLOCK-003 | Blocking is confirmed with one additional action (no accidental blocks) |
| FR-BLOCK-004 | Block state survives a page reload within the same browser session |
| FR-BLOCK-005 | Blocking is scoped: local/session scope by default; platform scope only for safety-class blocks |
| FR-BLOCK-006 | Blocking an abusive peer does not require the reporter to explain why |

### 8.8 Safety enforcement

| ID | Requirement |
| --- | --- |
| FR-SAFE-001 | Rate limits are enforced server-side on queue join, session creation, messages, reports, and signaling |
| FR-SAFE-002 | A cooldown is applied after rapid join/leave cycles |
| FR-SAFE-003 | Session duration is bounded |
| FR-SAFE-004 | A banned identity cannot join the queue |
| FR-SAFE-005 | Enforcement is progressive: warn → disconnect → temporary restriction → ban |
| FR-SAFE-006 | Every moderation action is recorded in an immutable audit log |
| FR-SAFE-007 | Users can see that moderation exists and that it is enforced, without being told how to evade it |
| FR-SAFE-008 | Illegal content reports are escalated per the escalation policy, not handled as ordinary reports |
| FR-SAFE-009 | A "safety exit" control is available from every screen and immediately returns to a safe landing state |

---

## 9. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-SEC-001 | All authorization decisions are made server-side; the client is never trusted |
| NFR-SEC-002 | WebSocket connections are authenticated before any protocol message is processed |
| NFR-SEC-003 | Session identifiers are unguessable (≥ 128 bits of entropy) and are never sequential |
| NFR-SEC-004 | Signaling messages are validated against a schema and bound to the authenticated session |
| NFR-SEC-005 | Cross-session message injection is impossible by construction (messages carry session + participant binding) |
| NFR-SEC-006 | TURN credentials are short-lived and scoped |
| NFR-SEC-007 | No secrets in client bundles, logs, or error messages |
| NFR-SEC-008 | Admin actions require a separate, strongly authenticated surface |
| NFR-PRIV-001 | No public profile is required at any point |
| NFR-PRIV-002 | Participants are identified by pseudonymous session identities, not accounts |
| NFR-PRIV-003 | IP addresses are not exposed to peers by default (see ADR-014 and PRIVACY.md) |
| NFR-PRIV-004 | Personal data collected is the minimum necessary for the feature |
| NFR-PRIV-005 | Chat content is not retained beyond the session (see RETENTION.md) |
| NFR-PRIV-006 | Users can request deletion of safety records within legal limits |
| NFR-SAFE-001 | The UI must distinguish connection failure, peer disconnect, moderation disconnect, user block, session timeout, and network issue |
| NFR-SAFE-002 | Confidential moderation reasoning is never exposed to an abusive user |
| NFR-SAFE-003 | The product must not claim perfect moderation |
| NFR-SAFE-004 | Leaving must always be possible in one action |
| NFR-PERF-001 | Initial JS payload budget (see PERFORMANCE.md) |
| NFR-PERF-002 | Queue join → server acknowledgement p95 < 300 ms |
| NFR-PERF-003 | Text message delivery p95 < 500 ms end-to-end |
| NFR-PERF-004 | WebRTC connection establishment p95 < 5 s on a typical 4G connection |
| NFR-PERF-005 | No unbounded client memory growth over a 60-minute session |
| NFR-OBS-001 | Queue size, match latency, match failure rate, session duration, report rate, and ban rate are measurable |
| NFR-OBS-002 | Dashboards must never display chat content |
| NFR-OBS-003 | Alerts fire on safety-relevant anomalies (report spikes, ban evasion patterns) |
| NFR-A11Y-001 | WCAG 2.2 AA conformance for all user-facing flows |
| NFR-A11Y-002 | All interactive controls reachable and operable by keyboard alone |
| NFR-A11Y-003 | Touch targets ≥ 44 × 44 CSS px |
| NFR-A11Y-004 | Respects `prefers-reduced-motion` |
| NFR-A11Y-005 | Session state changes are announced to assistive technology |
| NFR-REL-001 | Signaling disconnects are surfaced and recoverable without data loss of the session identity |
| NFR-REL-002 | ICE restart is attempted before declaring media failure |
| NFR-OPS-001 | A single engineer can operate production with documented runbooks |
| NFR-OPS-002 | Every safety-critical configuration change is auditable |

---

## 10. Moderation requirements

| ID | Requirement |
| --- | --- |
| FR-MOD-001 | Every report creates a moderation case with a stable ID |
| FR-MOD-002 | Cases are triaged by priority (minor safety / illegal content = P0) |
| FR-MOD-003 | Moderators can: allow, warn, disconnect, temporarily restrict, ban, or request manual review |
| FR-MOD-004 | Every moderation action records actor, action, target, reason code, and timestamp |
| FR-MOD-005 | Moderation actions are auditable and non-repudiable |
| FR-MOD-006 | Automated classification is **not** deployed in this phase; it is a PLANNED enhancement |
| FR-MOD-007 | Moderators cannot see chat content that has already been discarded (by design) |
| FR-MOD-008 | Ban enforcement is enforced at queue join, not only at session creation |

---

## 11. Privacy requirements

Summarised from [PRIVACY.md](PRIVACY.md). Full detail there.

- No account, email, phone, or public profile.
- Pseudonymous session identities only.
- IP addresses handled server-side; **not exposed to peers** (ADR-014 decision:
  hybrid — STUN for discovery, TURN-only fallback with no host-candidate leakage to peers
  where feasible; the final decision and its trade-offs are recorded in ADR-006 and
  ADR-014).
- No chat content retained.
- Report data retained on a defined, minimum-necessary schedule.
- Analytics limited to aggregate, non-content metrics.

---

## 12. Abuse-prevention requirements

Summarised from [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).

| ID | Requirement |
| --- | --- |
| FR-ABUSE-001 | Rate limits on: queue join, session creation, messages, reports, signaling messages, WebSocket frames |
| FR-ABUSE-002 | Cooldown after rapid join/leave cycles |
| FR-ABUSE-003 | Per-identity session and concurrency caps |
| FR-ABUSE-004 | TURN allocation quotas and short-lived credentials |
| FR-ABUSE-005 | Progressive restriction for repeat offenders |
| FR-ABUSE-006 | Ban-evasion detection via risk signals, **without** invasive fingerprinting by default |
| FR-ABUSE-007 | CAPTCHA is used only where a specific, documented abuse pattern justifies it |
| FR-ABUSE-008 | Report flooding and retaliatory reporting are detected and down-weighted |

---

## 13. Acceptance criteria

The phase is complete when **all** of the following are true. (These are the criteria
for the *documentation + skeleton* phase, not for a deployable product.)

1. Every document listed in [README.md](README.md) exists and contains actionable
   content — no empty placeholders.
2. ADR-001 … ADR-016 each contain Context, Problem, Decision Drivers, Options
   Considered, Decision, Consequences, Risks, Mitigations, Revisit Conditions, and
   References.
3. Every P0/P1 safety requirement appears in [docs/TRACEABILITY.md](docs/TRACEABILITY.md)
   with a design reference, ADR reference, module, task, skeleton file, and planned test.
4. No file under `src/` contains working matchmaking, signaling, WebRTC negotiation,
   database access, moderation logic, ban persistence, or report persistence.
5. Every port function that would require such logic throws
   `Not implemented: T-<ID>` and references its task ID.
6. Test files contain only `describe.todo` skeletons.
7. [docs/architecture/FINAL-REVIEW.md](docs/architecture/FINAL-REVIEW.md) is complete
   and every question is answered.
8. `docs/research/STACK-2026.md` classifies every considered technology as SELECTED,
   PLANNED, OPTIONAL, or REJECTED with a citation.

---

## 14. Edge cases

| ID | Edge case | Expected behaviour |
| --- | --- | --- |
| EC-01 | Both peers press Skip simultaneously | Exactly one session-end event; both users land in a clean post-session state |
| EC-02 | Participant cancels queue at the same instant a match is created | Match is aborted; no session is created for the departed participant |
| EC-03 | Peer disconnects during `CONNECTING` | Session transitions to `FAILED` with reason `peer-unavailable`; user can requeue |
| EC-04 | Peer disconnects during `ACTIVE` | UI states peer left; session ends; requeue offered |
| EC-05 | Report submitted while session is ending | Report is still accepted (FR-REPORT-002) |
| EC-06 | Block created while a requeue is in flight | Requeue does not return the blocked peer |
| EC-07 | Duplicate signaling message received | Idempotent handling by message ID; no duplicate effects |
| EC-08 | Reconnect to a stale session id | Rejected; user returns to a clean entry state |
| EC-09 | Camera permission denied | Specific recoverable state; text chat continues |
| EC-10 | Microphone permission denied | Same as EC-09 |
| EC-11 | WebRTC fails and TURN is unavailable | Explicit failure state; text chat continues; no silent hang |
| EC-12 | Network switches Wi-Fi → cellular | ICE restart attempted; user informed |
| EC-13 | Tab suspended / backgrounded on mobile | Session may end by timeout; user informed on return |
| EC-14 | Queue expires before a match | Retry or exit offered; no infinite loop |
| EC-15 | User navigates directly to `/chat/<id>` without a session | Access denied; redirected to entry |
| EC-16 | Two browser tabs for the same identity | One active session per identity enforced; the older tab is notified |
| EC-17 | Very long message past the limit | Rejected client-side with a clear message; never truncated silently |
| EC-18 | Link sent in chat | Rendered inert; not auto-fetched; no link preview |
| EC-19 | Rapid queue join/leave spam | Cooldown applied; progressive restriction if repeated |
| EC-20 | Report for a session that already ended | Accepted, referencing the ended session |
| EC-21 | Minor disclosed mid-session | Immediate termination, restriction, escalation per MINORS.md |
| EC-22 | Illegal content reported | Immediate escalation per SAFETY.md, not ordinary triage |
| EC-23 | Browser blocks third-party cookies / storage | Degrade to in-memory identity; no crash |
| EC-24 | Locale/timezone mismatch in report timestamps | Timestamps stored in UTC; displayed in local time |

---

## 15. Product metrics

Full definitions: [docs/product/METRICS.md](docs/product/METRICS.md).

**Guardrail metrics (safety-first, reviewed before any growth metric):**

- Report rate per 1,000 sessions
- P0 escalation rate (minor safety / illegal content)
- Ban rate and ban appeal rate
- Moderation disconnect rate
- Report acknowledgement latency
- Ban-evasion detection rate

**Experience metrics:**

- Time from landing to matched (median, p95)
- Match success rate
- Session duration distribution
- Skip rate and exit rate
- Queue abandonment rate
- Media setup failure rate
- Accessibility violation count

**Explicitly not tracked:** popularity, engagement streaks, or anything that rewards
keeping a user in a session longer.

---

## 16. Requirement ID summary

| Prefix | Domain | Count |
| --- | --- | --- |
| FR-ENTRY | Entry, age gate, consent | 10 |
| FR-QUEUE | Queue | 8 |
| FR-MATCH | Matchmaking | 12 |
| FR-CHAT | Text chat | 9 |
| FR-MEDIA | Audio / video | 9 |
| FR-REPORT | Reporting | 10 |
| FR-BLOCK | Blocking | 6 |
| FR-SAFE | Safety enforcement | 9 |
| FR-MOD | Moderation | 8 |
| FR-ABUSE | Abuse prevention | 8 |
| NFR-SEC | Security | 8 |
| NFR-PRIV | Privacy | 6 |
| NFR-SAFE | Safety UX | 4 |
| NFR-PERF | Performance | 5 |
| NFR-OBS | Observability | 3 |
| NFR-A11Y | Accessibility | 5 |
| NFR-REL | Reliability | 2 |
| NFR-OPS | Operability | 2 |
| **Total** | | **124** |

Counts are validated by [docs/TRACEABILITY.md](docs/TRACEABILITY.md). Every one of the
124 requirement IDs appears in the traceability matrix with a design reference, an ADR
reference, a module, a task, a skeleton file, and a planned test.
