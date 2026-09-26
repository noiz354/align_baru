# StrangerLink — Threat Model

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [SECURITY.md](SECURITY.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [docs/realtime/FAILURE-MODEL.md](docs/realtime/FAILURE-MODEL.md)

---

## 0. Method and scope

Threats are enumerated per boundary. Each entry specifies: **Threat, Boundary, Attack
Scenario, Impact, Likelihood, Mitigation, Verification, Requirement, Task.**

Boundaries:

| ID | Boundary |
| --- | --- |
| BT-1 | Browser ↔ Web service |
| BT-2 | Browser ↔ Realtime service (WebSocket) |
| BT-3 | Browser ↔ Browser (WebRTC media) |
| BT-4 | Web ↔ Realtime (internal) |
| BT-5 | Web ↔ PostgreSQL |
| BT-6 | Realtime ↔ coturn |
| BT-7 | Admin ↔ Web service |
| BT-8 | Peer ↔ Peer (social/human layer) |

Severity scale: **Critical / High / Medium / Low**.
Likelihood scale: **High / Medium / Low**.

---

## 1. Realtime and WebRTC threats

These are the threats most often omitted from web threat models, and they are the ones
most likely to hurt a user of this product.

### T-01 — Signaling spoofing

| Field | Value |
| --- | --- |
| **Threat** | A client sends a signaling message claiming to be a different participant |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker opens a WebSocket, sends `MESSAGE_SEND` with `fromParticipantId` set to their matched peer's ID, attempting to make the peer appear to say something they did not |
| **Impact** | Impersonation within a session; the peer is deceived about who said what. In a stranger-chat context this can be used to frame a user or to extract information |
| **Likelihood** | Medium |
| **Mitigation** | `fromParticipantId` must equal the authenticated socket identity; checked once in the dispatch layer; mismatch closes the connection (close code 1008) and raises a `SafetyEvent` of type `protocol-violation` |
| **Verification** | Test: "rejects a message whose fromParticipantId does not match the authenticated identity" |
| **Requirement** | NFR-SEC-004 |
| **Task** | T-SIG-011 |

### T-02 — Session takeover

| Field | Value |
| --- | --- |
| **Threat** | An attacker takes over another participant's active session |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker obtains or guesses a session ID and connects a second socket claiming that session |
| **Impact** | The attacker reads and sends messages as the victim; the victim's stranger sees attacker content attributed to the victim |
| **Likelihood** | Low |
| **Mitigation** | Session IDs are `uuidv7()` (≥122 bits entropy), server-generated only (INV-7); every session-scoped frame is authorized against the authenticated identity; a second socket for the same identity supersedes the first; stale sessions are rejected |
| **Verification** | Test: "rejects a connection to a session the identity does not belong to"; "rejects a stale session id" |
| **Requirement** | NFR-SEC-003, NFR-SEC-002 |
| **Task** | T-SIG-011, T-SESSION-004 |

### T-03 — Cross-session message injection

| Field | Value |
| --- | --- |
| **Threat** | A message is delivered to a participant in a different session |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker crafts a message with a `sessionId` or recipient reference pointing at another live session |
| **Impact** | A stranger receives content from someone they are not matched with; the consent model breaks |
| **Likelihood** | Low |
| **Mitigation** | `toParticipantId` is forbidden by schema; the recipient is **derived server-side** from the session; `sessionId` is authorized against the sender's membership |
| **Verification** | Test: "cannot deliver a message to a participant not in the session" |
| **Requirement** | NFR-SEC-005 |
| **Task** | T-SIG-011 |

### T-04 — ICE candidate abuse

| Field | Value |
| --- | --- |
| **Threat** | Malicious ICE candidates used to probe or attack the peer |
| **Boundary** | BT-3 |
| **Attack scenario** | Attacker sends candidates pointing at internal or attacker-controlled addresses to induce the victim's browser to send media somewhere unintended, or to fingerprint the victim's network |
| **Impact** | Network probing; media misdirection; information disclosure about the victim's network topology |
| **Likelihood** | Low |
| **Mitigation** | The relay is opaque (ADR-004) but candidate *count* is rate limited (100/session) and the total session is bounded; media failure is a normal, surfaced outcome; the user is never left in an ambiguous state. Browsers additionally restrict candidate handling |
| **Verification** | Test: "rate limits ICE candidates"; "surfaces a specific state on media failure" |
| **Requirement** | NFR-SEC-004, FR-MEDIA-007 |
| **Task** | T-MEDIA-081 |

### T-05 — TURN credential theft

| Field | Value |
| --- | --- |
| **Threat** | TURN credentials are captured and reused |
| **Boundary** | BT-2, BT-6 |
| **Attack scenario** | Attacker extracts a TURN username/password pair from a client bundle, a log, or a proxy and uses it to relay their own traffic |
| **Impact** | Free bandwidth on our infrastructure; cost; potential use as an open relay |
| **Likelihood** | Medium |
| **Mitigation** | Time-limited (minutes) HMAC credentials minted per session; the minting endpoint is authenticated and rate limited; the static secret exists only in the server secret store; credentials are never logged; relay-destination restrictions block private ranges |
| **Verification** | Test: "mints credentials with a bounded lifetime"; "refuses credential minting for a banned identity"; relay-to-private-range fails in staging |
| **Requirement** | NFR-SEC-006, FR-ABUSE-004 |
| **Task** | T-TURN-091 |

### T-06 — TURN bandwidth abuse

| Field | Value |
| --- | --- |
| **Threat** | A participant consumes disproportionate relay bandwidth |
| **Boundary** | BT-6 |
| **Attack scenario** | Attacker repeatedly opens video sessions and forces TURN relay to run up our bill |
| **Impact** | Cost; degraded service for others |
| **Likelihood** | Medium |
| **Mitigation** | Per-identity and per-server allocation quotas; session duration caps; per-identity bandwidth accounting with alerting; an over-threshold identity is rate limited and reviewed |
| **Verification** | Load test with TURN forced; alert fires at threshold |
| **Requirement** | FR-ABUSE-004, NFR-PERF-004 |
| **Task** | T-TURN-091, T-ABUSE-061 |

### T-07 — WebSocket flooding

| Field | Value |
| --- | --- |
| **Threat** | A client opens many connections or sends many frames |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker opens thousands of sockets or sends frames at maximum rate to exhaust the realtime service |
| **Impact** | Realtime service degradation; legitimate users cannot match |
| **Likelihood** | High |
| **Mitigation** | Handshake authentication before the socket opens; origin allowlist; `maxPayload` cap; per-connection frame rate limit; per-instance connection cap with alerting; zombie termination via heartbeat; realtime isolated from the web tier |
| **Verification** | Load test; connection-count alert fires |
| **Requirement** | FR-ABUSE-001, NFR-SEC-002 |
| **Task** | T-ABUSE-061 |

### T-08 — Message flooding

| Field | Value |
| --- | --- |
| **Threat** | A participant floods their peer with messages |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker sends messages at maximum rate, or very long messages, to make the session unusable |
| **Impact** | Denial of service against the peer; harassment |
| **Likelihood** | High |
| **Mitigation** | 2000-char limit; 1 message/s with burst 5; 300 messages/session; identical-content rejection; the peer can skip, report, or block at any time |
| **Verification** | Test: "rejects a message over the length limit"; "rate limits messages per session" |
| **Requirement** | FR-CHAT-003, FR-CHAT-004 |
| **Task** | T-CHAT-001 |

### T-09 — Peer impersonation

| Field | Value |
| --- | --- |
| **Threat** | A participant falsely claims to be someone else to the peer |
| **Boundary** | BT-3, BT-2 |
| **Attack scenario** | Attacker tells their stranger "I'm your neighbour" or fabricates an identity |
| **Impact** | Social engineering; the peer discloses personal information |
| **Likelihood** | High |
| **Mitigation** | **Structural:** there is no profile, no name, no verified identity to impersonate. The UI never displays peer identity. The safety notice states that the other person is a stranger whose identity we cannot verify. The user can report and block |
| **Verification** | UI review; no peer identity surface exists |
| **Requirement** | NFR-SAFE-003, FR-SAFE-007 |
| **Task** | T-SAFE-031 |

### T-10 — Session fixation

| Field | Value |
| --- | --- |
| **Threat** | An attacker fixes a session ID that a victim later joins |
| **Boundary** | BT-1, BT-2 |
| **Attack scenario** | Attacker pre-creates a session identifier and induces a victim to navigate to `/chat/<attacker-chosen-id>` |
| **Impact** | The attacker controls the session the victim enters |
| **Likelihood** | Low |
| **Mitigation** | Session IDs are server-generated only and never accepted from a client (INV-7); the URL session ID is additionally authorized against the authenticated identity on every request |
| **Verification** | Test: "never accepts a client-supplied session id" |
| **Requirement** | NFR-SEC-003 |
| **Task** | T-SESSION-004 |

### T-11 — Replay

| Field | Value |
| --- | --- |
| **Threat** | A captured signaling message is replayed |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker captures a `BLOCK_CREATED` or `MESSAGE_SEND` frame and replays it |
| **Impact** | Duplicate effects; unintended state changes |
| **Likelihood** | Medium |
| **Mitigation** | `messageId` idempotency keyed per session; `sequence` monotonicity per direction; out-of-order messages buffered then rejected |
| **Verification** | Test: "drops a duplicate signaling message" |
| **Requirement** | NFR-SEC-004 |
| **Task** | T-SIG-011 |

### T-12 — IP exposure

| Field | Value |
| --- | --- |
| **Threat** | A peer's public IP address is revealed to the stranger they are talking to |
| **Boundary** | BT-3 |
| **Attack scenario** | Not an attack so much as a consequence: during direct P2P media, ICE candidate exchange reveals public addresses |
| **Impact** | Approximate geolocation; correlation across sessions; off-platform harassment; in the worst case physical risk |
| **Likelihood** | Medium (for video users) |
| **Mitigation** | Disclosed in the safety notice and privacy notice (ADR-014); TURN always available; TURN-only mode PLANNED; region-specific hardening available as configuration |
| **Verification** | Notice renders on the media-mode entry path (test) |
| **Requirement** | NFR-PRIV-003 |
| **Task** | T-PRIV-101 |

### T-13 — Malicious peer behaviour

| Field | Value |
| --- | --- |
| **Threat** | The peer themselves is the threat |
| **Boundary** | BT-8 |
| **Attack scenario** | Harassment, exposure, sexual content, scams, grooming attempts, threats |
| **Impact** | Direct harm to the user |
| **Likelihood** | High |
| **Mitigation** | Report and block always reachable; immediate session end on report; P0 escalation for minor safety and illegal content; progressive restrictions; no attachments; no off-platform channel; session duration cap |
| **Verification** | Manual QA scenarios; report rate monitoring |
| **Requirement** | FR-REPORT-001, FR-BLOCK-001, FR-SAFE-008 |
| **Task** | T-REPORT-006, T-SAFE-052 |

---

## 2. Application security threats

### T-14 — XSS

| Field | Value |
| --- | --- |
| **Threat** | Script injection via message content, report notes, or any user-supplied string |
| **Boundary** | BT-1 |
| **Attack scenario** | Attacker sends a message containing markup that executes in the peer's browser |
| **Impact** | Session theft, defacement, malware |
| **Likelihood** | Medium |
| **Mitigation** | Text-only rendering; no `dangerouslySetInnerHTML` (lint rule); strict CSP without `unsafe-inline`/`unsafe-eval`; Zod validation at every boundary |
| **Verification** | Automated XSS payload suite in CI |
| **Requirement** | NFR-SEC-001 |
| **Task** | T-SEC-071 |

### T-15 — CSRF

| Field | Value |
| --- | --- |
| **Threat** | A third-party site forces an authenticated user to perform an action |
| **Boundary** | BT-1 |
| **Attack scenario** | Attacker's page triggers a report or block submission on the user's behalf |
| **Impact** | Unintended safety actions; nuisance |
| **Likelihood** | Low |
| **Mitigation** | CSRF tokens; `SameSite` cookies; origin verification; custom-header requirement on mutating requests |
| **Verification** | Test: "rejects a mutating request without a valid CSRF token" |
| **Requirement** | NFR-SEC-001 |
| **Task** | T-SEC-071 |

### T-16 — SQL injection

| Field | Value |
| --- | --- |
| **Threat** | Injection through any input reaching a query |
| **Boundary** | BT-5 |
| **Attack scenario** | Attacker crafts a report note or interest value containing SQL |
| **Impact** | Data breach; data loss |
| **Likelihood** | Low |
| **Mitigation** | Parameterised queries only; all SQL behind repository ports; a test asserts no other module imports a driver; least-privilege role |
| **Verification** | Test: "no module outside src/server/db imports a database driver"; injection payload suite |
| **Requirement** | NFR-SEC-001 |
| **Task** | T-SEC-071 |

### T-17 — IDOR

| Field | Value |
| --- | --- |
| **Threat** | Accessing another user's session, report, or data by identifier |
| **Boundary** | BT-1, BT-2 |
| **Attack scenario** | Attacker iterates session IDs or report IDs |
| **Impact** | Privacy breach |
| **Likelihood** | Medium |
| **Mitigation** | Unguessable `uuidv7()` IDs; server-side authorization on every request; no enumerable surfaces |
| **Verification** | Authorization test matrix |
| **Requirement** | NFR-SEC-001, NFR-SEC-003 |
| **Task** | T-SEC-071 |

### T-18 — Open redirect

| Field | Value |
| --- | --- |
| **Threat** | Redirect parameter used to send a user to an attacker's site |
| **Boundary** | BT-1 |
| **Attack scenario** | `/start?next=https://evil.example` |
| **Impact** | Phishing |
| **Likelihood** | Low |
| **Mitigation** | Internal-path allowlist; no absolute user-supplied redirect targets |
| **Verification** | Test: "rejects an external redirect target" |
| **Requirement** | NFR-SEC-001 |
| **Task** | T-SEC-071 |

### T-19 — Admin privilege escalation

| Field | Value |
| --- | --- |
| **Threat** | A non-admin, or a lower-privilege moderator, reaches admin capability |
| **Boundary** | BT-7 |
| **Attack scenario** | Attacker probes `/admin/*` routes, or a moderator attempts to ban without authority |
| **Impact** | Unauthorized enforcement; audit integrity loss |
| **Likelihood** | Low |
| **Mitigation** | Separate authenticated surface; individual accounts; MFA; server-side role checks on every request (never middleware alone); no self-escalation; full audit |
| **Verification** | Test: "a non-admin cannot reach any admin route"; "a moderator cannot perform an admin action" |
| **Requirement** | NFR-SEC-008 |
| **Task** | T-MOD-042 |

### T-20 — Secret leakage

| Field | Value |
| --- | --- |
| **Threat** | Secrets reach a client bundle, log, image, or repository |
| **Boundary** | All |
| **Attack scenario** | A `NEXT_PUBLIC_` prefix accidentally applied to a secret; a secret in a log line |
| **Impact** | TURN abuse; database compromise; admin compromise |
| **Likelihood** | Medium |
| **Mitigation** | Secret scanning in CI; `NEXT_PUBLIC_` discipline enforced by review; secrets injected at runtime; image scanning; no secrets in error messages |
| **Verification** | CI secret scan; bundle inspection test |
| **Requirement** | NFR-SEC-007 |
| **Task** | T-SEC-071 |

### T-21 — Log leakage

| Field | Value |
| --- | --- |
| **Threat** | Sensitive data written to logs |
| **Boundary** | All |
| **Attack scenario** | A debug log line includes a message body, an IP, or a report note |
| **Impact** | Privacy breach; a de facto conversation archive |
| **Likelihood** | Medium |
| **Mitigation** | Explicit no-log list (content, notes, IPs, credentials, tokens, SDP); a shared logging helper with an allowlist; log access restricted and audited; separate retention tier |
| **Verification** | Test: "the logging helper rejects disallowed keys" |
| **Requirement** | NFR-PRIV-004, NFR-OBS-002 |
| **Task** | T-OBS-111 |

### T-22 — Dependency risk

| Field | Value |
| --- | --- |
| **Threat** | A vulnerable or malicious dependency |
| **Boundary** | All |
| **Attack scenario** | A transitive dependency with a known RCE |
| **Impact** | Full compromise |
| **Likelihood** | Medium |
| **Mitigation** | `npm audit` / Dependabot blocking on critical; exact pinning; deliberate upgrades; framework security releases patched within 72 hours as safety incidents |
| **Verification** | CI gate |
| **Requirement** | NFR-SEC-007 |
| **Task** | T-SEC-071 |

---

## 3. Abuse threats

### T-23 — Botting

| Field | Value |
| --- | --- |
| **Threat** | Automated clients participate in sessions |
| **Boundary** | BT-2 |
| **Attack scenario** | A script joins the queue and sends scam messages at scale |
| **Impact** | User harm; product reputation |
| **Likelihood** | High |
| **Mitigation** | Handshake authentication; connection rate limits; CAPTCHA on sustained flooding (not on first visit); behavioural review flags; report and block |
| **Verification** | Load and abuse simulation tests |
| **Requirement** | FR-ABUSE-002, FR-ABUSE-007 |
| **Task** | T-ABUSE-062 |

### T-24 — Rapid reconnect abuse

| Field | Value |
| --- | --- |
| **Threat** | Repeated connect/disconnect to evade limits or harass |
| **Boundary** | BT-2 |
| **Attack scenario** | Attacker reconnects repeatedly to reset rate-limit windows |
| **Impact** | Limit evasion; service degradation |
| **Likelihood** | Medium |
| **Mitigation** | Limits are per **identity**, not per connection; one active session per identity; `SESSION_SUPERSEDED`; reconnect rate limits; bounded reconnect window |
| **Verification** | Test: "rate limits are per identity, not per connection" |
| **Requirement** | FR-SAFE-001, FR-MATCH-002 |
| **Task** | T-ABUSE-061 |

### T-25 — Report abuse and retaliation

| Field | Value |
| --- | --- |
| **Threat** | False, retaliatory, or flooding reports |
| **Boundary** | BT-1, BT-2 |
| **Attack scenario** | Attacker reports many peers to get them restricted, or floods reports to overwhelm triage |
| **Impact** | Innocent users restricted; triage overwhelmed |
| **Likelihood** | Medium |
| **Mitigation** | Report rate limit; dedup on (session, category); credibility weighting for identities reporting many distinct peers; reports never auto-ban; appeals with a moderator who did not issue the ban |
| **Verification** | Test: "collapses duplicate reports"; "down-weights reports from an identity reporting many peers" |
| **Requirement** | FR-REPORT-006, FR-REPORT-007, FR-ABUSE-008 |
| **Task** | T-REPORT-006 |

### T-26 — Ban evasion

| Field | Value |
| --- | --- |
| **Threat** | A banned user returns under a new identity |
| **Boundary** | All |
| **Attack scenario** | Clear storage, new browser, VPN, rejoin |
| **Impact** | The enforcement ladder is defeated for determined abusers |
| **Likelihood** | High |
| **Mitigation** | Layered cost-raising: identity bans, risk-signal rate limits and cooldowns, allocation quotas, behavioural review flags. **No fingerprinting.** Human review for evasion determinations. Disclosed as a limitation |
| **Verification** | Abuse simulation; documented limitation in SAFETY.md |
| **Requirement** | FR-SAFE-004, FR-ABUSE-006 |
| **Task** | T-BAN-052 |

### T-27 — Stalking

| Field | Value |
| --- | --- |
| **Threat** | A user repeatedly attempts to reconnect with a specific stranger |
| **Boundary** | BT-8 |
| **Attack scenario** | Repeated requeue hoping to be rematched; asking for contact details |
| **Impact** | Severe harm to the target |
| **Likelihood** | Medium |
| **Mitigation** | Recent-peer avoidance; block enforcement; consecutive-requeue cap; immediate-skip cadence detection; no user discovery, no profiles, no directory; safety notice advises against sharing contact details |
| **Verification** | Test: "does not immediately rematch blocked participants"; "caps consecutive requeues" |
| **Requirement** | FR-MATCH-005, FR-BLOCK-002 |
| **Task** | T-MATCH-021 |

### T-28 — Scam and phishing

| Field | Value |
| --- | --- |
| **Threat** | Fraudulent solicitation |
| **Boundary** | BT-8 |
| **Attack scenario** | "Click this link to verify your account" |
| **Impact** | Financial harm; credential theft |
| **Likelihood** | High |
| **Mitigation** | Inert links; no auto-fetch; report category "scam"; P1 triage; message rate limits; session caps |
| **Verification** | Manual QA; report monitoring |
| **Requirement** | FR-CHAT-005, FR-REPORT-003 |
| **Task** | T-CHAT-001 |

### T-29 — Sexual exploitation and CSAM

| Field | Value |
| --- | --- |
| **Threat** | Distribution of child sexual abuse material or grooming |
| **Boundary** | BT-8, BT-3 |
| **Attack scenario** | A participant attempts to solicit a minor or share illegal content |
| **Impact** | Catastrophic harm to a child; severe legal exposure |
| **Likelihood** | Low but non-zero |
| **Mitigation** | 18+ gate; **no attachments** (the primary vector is structurally absent); **no media recording**; no private channels; no user discovery; P0 escalation with a dedicated always-monitored queue; immediate termination; legal-counsel-led law-enforcement escalation; minors policy |
| **Verification** | P0 acknowledgement latency metric; escalation drill |
| **Requirement** | FR-SAFE-008, FR-ENTRY-006 |
| **Task** | T-SAFE-052 |

---

## 4. Privacy threats

### T-30 — Moderation becoming surveillance

| Field | Value |
| --- | --- |
| **Threat** | The moderation subsystem accumulates more data than it needs |
| **Boundary** | BT-7 |
| **Attack scenario** | A well-intentioned contributor adds chat logging "for moderation" |
| **Impact** | The product becomes a surveillance system; privacy promise broken |
| **Likelihood** | Medium |
| **Mitigation** | Chat content is not stored, so there is nothing to accumulate; moderators see metadata only; IP access requires a documented investigation with an audit record; a schema test asserts no message-content column exists; adding one requires a new ADR |
| **Verification** | Schema test; access review |
| **Requirement** | NFR-PRIV-004, NFR-PRIV-005 |
| **Task** | T-PRIV-101 |

### T-31 — Excessive retention

| Field | Value |
| --- | --- |
| **Threat** | Data is kept longer than the schedule |
| **Boundary** | BT-5 |
| **Attack scenario** | The retention job silently fails |
| **Impact** | A database leak exposes more than disclosed; legal exposure |
| **Likelihood** | Medium |
| **Mitigation** | Scheduled, idempotent, logged retention job that **alerts on failure** and is treated as a privacy incident; a test asserts expired rows are gone |
| **Verification** | Retention job test; alert drill |
| **Requirement** | NFR-PRIV-005 |
| **Task** | T-RET-131 |

### T-32 — Analytics overreach

| Field | Value |
| --- | --- |
| **Threat** | Analytics collects content or identity linkage |
| **Boundary** | BT-1 |
| **Attack scenario** | A product analytics SDK auto-captures screen content or message text |
| **Impact** | Privacy breach; a de facto conversation archive in a third party |
| **Likelihood** | Medium |
| **Mitigation** | No third-party analytics SDK in the chat surface; aggregate metrics only via OpenTelemetry with an attribute allowlist; a test asserts the allowlist contains no content keys |
| **Verification** | Allowlist test; network request inspection in E2E |
| **Requirement** | NFR-PRIV-004, NFR-OBS-002 |
| **Task** | T-OBS-111 |

---

## 5. Availability threats

### T-33 — Realtime service exhaustion

| Field | Value |
| --- | --- |
| **Threat** | The realtime service is overwhelmed |
| **Boundary** | BT-2 |
| **Attack scenario** | Connection flood or a resource leak |
| **Impact** | No new matches |
| **Likelihood** | Medium |
| **Mitigation** | Connection caps; heartbeat with zombie termination; realtime isolated from web; queue capacity cap; load testing before VS-15 |
| **Verification** | Load test; connection-count alert |
| **Requirement** | NFR-PERF-002, FR-ABUSE-001 |
| **Task** | T-ABUSE-061 |

### T-34 — PostgreSQL unavailability

| Field | Value |
| --- | --- |
| **Threat** | The database is unreachable |
| **Boundary** | BT-5 |
| **Attack scenario** | Outage or connection-pool exhaustion |
| **Impact** | No durable writes; ban checks unavailable |
| **Likelihood** | Low |
| **Mitigation** | **Ban checks fail closed** — if the ban store is unreachable, we do not match. Reports fail visibly rather than silently. Queue and active sessions continue (in-memory) |
| **Verification** | Chaos test: database down; assert no new matches |
| **Requirement** | NFR-SAFE-004 |
| **Task** | T-BAN-051 |

### T-35 — coturn unavailability

| Field | Value |
| --- | --- |
| **Threat** | TURN is down or saturated |
| **Boundary** | BT-6 |
| **Attack scenario** | Outage, or quota exhaustion under abuse |
| **Impact** | Video/audio fails for restrictive networks |
| **Likelihood** | Medium |
| **Mitigation** | Specific surfaced failure state; text chat continues; allocation-failure alert; quotas; monitoring |
| **Verification** | Staging TURN outage drill |
| **Requirement** | FR-MEDIA-007 |
| **Task** | T-TURN-091 |

---

## 6. Threat summary

| Severity | Count | IDs |
| --- | --- | --- |
| Critical | 4 | T-29, T-30, T-02 (impact), T-01 (impact class) |
| High | 12 | T-05, T-06, T-07, T-08, T-13, T-24, T-25, T-26, T-27, T-31, T-33, T-34 |
| Medium | 12 | T-04, T-09, T-11, T-12, T-14, T-17, T-20, T-21, T-22, T-28, T-32, T-35 |
| Low | 7 | T-03, T-10, T-15, T-16, T-18, T-19, T-23 (likelihood-adjusted) |

**Every threat has at least one named mitigation and at least one verification method.**
Threats whose verification is "manual QA" or "drill" rather than an automated test are
explicitly marked as such.

---

## 7. Assumptions

1. The browser is hostile. No client-side control is a security control.
2. The peer is a stranger with no prior relationship and no accountability.
3. Attackers are motivated, numerous, and sometimes automated.
4. Some attackers are highly capable and will evade identity-based controls.
5. Legal obligations vary by jurisdiction and require counsel.
6. A privacy failure is a safety failure.
