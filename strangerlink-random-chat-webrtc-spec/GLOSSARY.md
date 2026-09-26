# StrangerLink — Glossary

- **Status:** Architecture phase
- **Last updated:** 2026-09-26

---

## A

**Abuse prevention**
Raising the cost of abusive behaviour. In this product it is explicitly a *cost-raising*
exercise, not an elimination exercise. See [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).

**Active session**
A `ChatSession` in a non-terminal status. A participant may belong to at most one
(INV-1).

**ADR (Architecture Decision Record)**
A document recording a decision, its context, the options considered, its consequences,
risks, mitigations, and the conditions that would reopen it. See [ADR.md](ADR.md).

**Age gate**
The affirmative 18+ self-attestation required before any chat capability. Self-attestation,
not identity verification. See [docs/safety/AGE-GATING.md](docs/safety/AGE-GATING.md).

**Anonymous session identity**
See **Session identity**.

**Appeal**
The process by which a restricted or banned user challenges an enforcement decision.
Reviewed by a moderator other than the issuer where staffing allows.

## B

**Ban**
The strongest enforcement outcome. The subject is always a pseudonymous session identity,
never an IP address or device. See [ADR-012](docs/adr/ADR-012-ban-enforcement.md).

**Ban evasion**
Returning after a ban under a new identity. Detected through risk signals and behavioural
review; **not** through device fingerprinting.

**Block**
A user-initiated instruction not to be rematched with a specific peer. Scoped `session` or
`platform`. See [docs/safety/BLOCKING.md](docs/safety/BLOCKING.md).

**Bounded context**
A boundary within which a domain model is consistent. See [DOMAIN.md](DOMAIN.md).

## C

**CANCELLED**
A *queue* state, not a session state. A participant who cancels while `WAITING` never
creates a session.

**CAPTCHA**
A challenge used only where a specific, documented abuse pattern justifies it. Never on
first visit. See [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) §6.

**ChatMode**
`TEXT`, `TEXT_AUDIO`, or `TEXT_VIDEO`. Enforced at match time; incompatible modes are
never matched.

**Claim**
The single-flight primitive that guarantees a participant is matched at most once. The
mechanism behind INV-1.

**Cooldown**
A temporary inability to join the queue, applied after rapid join/leave cycles. Shown
honestly to the user, never disguised as a network error.

**Consent**
The versioned acknowledgement of the safety notice, ephemerality, and exit rights. Required
alongside the age gate.

**coturn**
The open-source STUN/TURN server used for ICE candidate gathering and media relay. Runs in
a dedicated network segment. See [ADR-006](docs/adr/ADR-006-turn-strategy.md).

## D

**Dark pattern**
A manipulative interface choice. Forbidden in this product: forced camera access, hidden
reporting, infinite requeue loops, deceptive safety claims, addictive gamification,
popularity scores, engagement streaks. See [DESIGN.md](DESIGN.md) §1.

**Delivery status**
`pending`, `delivered`, or `rejected`. There are deliberately **no read receipts** and no
typing indicators.

**DTLS-SRTP**
The encryption used for WebRTC media. Media is encrypted in transit; it is never recorded.

## E

**Eligibility check**
The set of constraints evaluated before a participant may be matched: bans, restrictions,
blocks, recent peers, mode compatibility, and the one-active-session invariant.

**Ephemeral**
Existing only for the duration of a session. Chat content is ephemeral and is never stored.

**Escalation**
Routing a report to a higher-severity queue. P0 (minor safety, illegal content, threats)
bypasses normal triage entirely and pages the on-call.

## F

**Fail closed**
When a safety check cannot be evaluated, deny the action. Ban checks fail closed: if the
ban store is unreachable, no new matches are created.

**Fingerprinting (device)**
Identifying a device through browser characteristics. **Deliberately not used** in this
product. See [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) §5.2.

## G

**getUserMedia**
The browser API used to access camera and microphone. Always requires an explicit user
gesture in this product.

## I

**ICE (Interactive Connectivity Establishment)**
The process by which WebRTC discovers a working network path between two peers, using host,
server-reflexive, and relay candidates.

**ICE restart**
Re-running ICE to recover a broken connection. At most one automatic restart is attempted;
a restart loop is worse than a clear failure.

**IDOR (Insecure Direct Object Reference)**
Accessing another user's object by identifier. Mitigated by unguessable `uuidv7` IDs and
server-side authorization on every request.

**Interest**
A tag selected from a **closed, server-controlled vocabulary**. A matching preference, never
a guarantee, and never shown to the peer.

**INV-1**
The central invariant: a participant has at most one session in a non-terminal status.

**IP exposure**
The residual privacy risk that a peer's public IP address is revealed during direct P2P
media. Documented and disclosed. See [ADR-014](docs/adr/ADR-014-anonymity-model.md).

## L

**Link (inert)**
A URL in a chat message is displayed as plain text and is never auto-fetched or previewed.
Opening requires an explicit user action.

## M

**Matchmaking**
The process of selecting two eligible waiting participants and creating a session. Runs
in-memory in the realtime service. No ranking, no profiling. See
[MATCHMAKING.md](MATCHMAKING.md).

**Media plane**
The WebRTC connection carrying audio and video directly between browsers, or via a TURN
relay. Carries **no authorization information**. Contrast **signaling plane**.

**Moderation case**
A triaged report awaiting a moderation decision. See [MODERATION.md](MODERATION.md).

**Moderation outcome**
One of: `allow`, `warn`, `disconnect`, `restrict`, `ban`, `manual-review`.

## N

**NAT traversal**
The techniques (STUN, TURN) that allow two browsers behind network address translation to
connect.

## O

**One active session per participant**
See **INV-1**.

## P

**P2P (peer-to-peer)**
A direct connection between two browsers without an intermediary media server.

**Participant**
A pseudonymous session identity. Not an account, not a user record, not a profile.

**Peer**
The other participant in a session. Always a stranger.

**Policy version**
The version of the safety/moderation policy in force when an action was taken. Recorded on
every ban and audit event so decisions can be reconstructed.

**Progressive enforcement**
Escalating consequences: warn → disconnect → temporary restriction → ban. A requirement
(FR-SAFE-005), not a preference.

**Pseudonymous**
Identified by a generated identifier with no link to a real-world identity.

## Q

**Queue**
The in-memory waiting list. Never persisted to PostgreSQL — a durable queue table would be
a durable record of who was looking for a stranger.

**Queue timeout**
The bounded maximum wait. On expiry the user is offered a retry or a clean exit. **No
automatic requeue.**

## R

**Recent-peer avoidance**
A bounded in-memory window preventing immediate rematch with a recent peer.

**Reconnect window**
The bounded period during which a dropped WebSocket may be re-established without ending
the session.

**Report**
A user-submitted safety report about a session. Accepted even against a terminal session
(FR-REPORT-002).

**Requirement ID**
A stable identifier of the form `FR-<DOMAIN>-<NNN>` or `NFR-<DOMAIN>-<NNN>`. See
[PRD.md](PRD.md) §16.

**Restriction**
A temporary inability to join the queue. Distinct from a ban; shorter and reversible.

**Retention**
How long each class of data is kept. The default is the shortest workable period. See
[RETENTION.md](RETENTION.md).

**Risk signal**
A coarse, one-way-hashed IP-derived signal used **only** for rate limiting and cooldowns.
It can never trigger a standalone ban. Not a fingerprint.

**RTCPeerConnection**
The browser API object representing a WebRTC connection.

## S

**SDP (Session Description Protocol)**
The media negotiation format exchanged during WebRTC setup. Treated as an **opaque payload**
by the server; the server never parses it.

**Session identity**
The pseudonymous identity a participant holds. Created without any credential; dies with
the browser session.

**Session metadata**
The durable record of a session: participants, mode, duration, timestamps, end reason.
Deliberately contains **no** content reference. Retained 30 days.

**Session supersession**
When a second connection for the same identity replaces the first. Handles two-tab use and
reconnect races.

**Signaling plane**
The authenticated, schema-validated WebSocket channel through the server that carries
queue, match, SDP, ICE, chat, and safety messages. **All authorization lives here.**

**Skip**
Ending the current session and being offered a new match. One action, no confirmation
trap.

**SRFLX candidate**
A server-reflexive candidate: the public IP:port mapping discovered via a STUN server.
One of the sources of IP exposure.

**STUN (Session Traversal Utilities for NAT)**
The protocol used to discover a public address mapping. Public STUN servers are acceptable
for discovery only.

## T

**TASK ID**
A stable identifier of the form `T-<DOMAIN>-<NNN>` used in `Not implemented` errors and
TODOs. See [TASKS.md](TASKS.md).

**Tier (retention)**
One of eight retention classes, 0 (never stored) through 7 (shortest workable). See
[RETENTION.md](RETENTION.md) §1.

**Trickle ICE**
Exchanging ICE candidates as they are gathered rather than waiting for gathering to
complete.

**TURN (Traversal Using Relays around NAT)**
A relay protocol used when direct P2P fails. coturn provides it, with time-limited
credentials.

**TURN-only**
A topology in which all media is relayed and no address-revealing candidates are exchanged.
**PLANNED**, not the default. See [ADR-014](docs/adr/ADR-014-anonymity-model.md).

## U

**Unguessable identifier**
An identifier with ≥ 122 bits of entropy, generated server-side, never sequential, never
accepted from a client. In this product: `uuidv7`.

## V

**Vertical slice (VS)**
A thin, end-to-end increment of functionality. See [ROADMAP.md](ROADMAP.md).

## W

**WCAG 2.2 AA**
The accessibility conformance target. Accessibility failures are treated as safety
failures in this product. See [ACCESSIBILITY.md](ACCESSIBILITY.md).

**WebSocket flooding**
An attack in which a client opens many connections or sends many frames. Mitigated by
handshake authentication, `maxPayload`, per-connection rate limits, connection caps, and
heartbeat-based zombie termination.

## Z

**Zombie socket**
A WebSocket connection that is no longer responsive but has not been closed. Terminated by
protocol-level heartbeat.
