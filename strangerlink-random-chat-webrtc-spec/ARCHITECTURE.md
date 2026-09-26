# StrangerLink — Architecture

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DOMAIN.md](DOMAIN.md), [ADR.md](ADR.md), [docs/architecture/FINAL-REVIEW.md](docs/architecture/FINAL-REVIEW.md)

---

## 1. Architectural position

StrangerLink is a **small system with a large safety surface**. The architecture is
deliberately conservative: four deployable services, one durable datastore, one realtime
transport, no message broker, no microservice mesh, no media server.

The dominant architectural constraint is not scale — it is that **safety properties must
be enforceable at a single, server-side, testable point**, and that **almost nothing about
a conversation may persist**.

### Principles

| # | Principle | Consequence |
| --- | --- | --- |
| P1 | **Server is the only authority** | The client is never trusted for authorization, session state, eligibility, or limits (NFR-SEC-001) |
| P2 | **Safety is a subsystem, not a feature** | `moderation`, `reports`, `blocks`, `bans`, `safety` are first-class bounded contexts with their own ADRs |
| P3 | **Ephemeral by default** | Chat content is never stored; queue and connection state dies with the process |
| P4 | **Pseudonymous, not anonymous-by-accident** | Session identities are designed; IP exposure is documented (ADR-014) |
| P5 | **Signaling and media are separate planes** | Authorization lives only in the signaling plane |
| P6 | **Smallest thing that works** | No Kafka, no Redis (yet), no SFU, no Kubernetes (yet), no microservices |
| P7 | **Observable without being invasive** | Traces and metrics carry identifiers and durations, never content (ADR-015) |
| P8 | **Documented races over clever code** | Every concurrency hazard is named and has a designated resolution |

---

## 2. System context

```
                            ┌──────────────────────┐
                            │      Browser         │
                            │  (React 19 client)   │
                            └──────┬────────┬──────┘
                                   │        │
                      HTTPS + JSON │        │ WebRTC media (SRTP/DTLS)
                                   │        │      ▲          │
                                   ▼        │      │          ▼
                     ┌──────────────────┐    │  ┌───┴──────────────┐
                     │   Web Service    │    │  │  Peer Browser    │
                     │  Next.js 16      │    │  │  (via TURN relay │
                     │  (SSR + API)     │    │  │   when needed)   │
                     └────────┬─────────┘    │  └──────────────────┘
                              │              │
              ┌───────────────┼───────┐      │
              │               │       │      │
              ▼               ▼       ▼      │
     ┌──────────────┐  ┌──────────────┐  ┌───┴───────────┐
     │  PostgreSQL  │  │  Realtime    │  │    coturn     │
     │     18       │  │  Service (ws)│  │  TURN/STUN    │
     └──────────────┘  └──────┬───────┘  └───────────────┘
                              │
                     ┌────────┴────────┐
                     │  OTel Collector │
                     └─────────────────┘
```

### Trust boundaries

| Boundary | Crosses it | Controls |
| --- | --- | --- |
| BT-1 Browser ↔ Web | HTTPS, JSON, cookies | TLS, CSRF, origin checks, server-side authz |
| BT-2 Browser ↔ Realtime | `wss://`, signaling frames | Handshake auth, origin allowlist, Zod validation, per-frame rate limit, `maxPayload` |
| BT-3 Browser ↔ Browser (media) | SRTP over DTLS | DTLS-SRTP; **no authorization information in this plane** |
| BT-4 Web ↔ Realtime | Internal, authenticated | mTLS or signed internal token; not internet-reachable |
| BT-5 Web ↔ PostgreSQL | TCP + TLS | Least-privilege role, SCRAM, connection pooling |
| BT-6 Realtime ↔ coturn | Internal control plane | Credential minting endpoint; authenticated, rate limited |
| BT-7 Admin ↔ Web | HTTPS | Separate, strongly authenticated admin surface; role-scoped |

---

## 3. Services

### 3.1 Web service (Next.js 16)

**Responsibility:** rendering, entry funnel, authorization gates, report submission,
TURN credential minting, admin surface.

**Does not:** hold WebSocket connections, participate in media, or contain matching
logic.

**Key rule:** authorization is re-checked server-side in every handler. Middleware is
never the sole gate (ADR-001).

### 3.2 Realtime service (`ws`)

**Responsibility:** WebSocket lifecycle, queue, matchmaking, session state machine,
signaling relay, chat message fan-out, in-session rate limiting.

**Does not:** access the database directly for durable writes (it emits events consumed
by the web service, or writes via a narrow port), interpret SDP, or store message
content.

**State:** entirely in-memory. A restart ends in-flight sessions with reason
`server-restart`.

### 3.3 coturn (TURN/STUN)

**Responsibility:** ICE candidate gathering (STUN) and media relay (TURN).

**Placement:** dedicated network segment, no access to application infrastructure,
relay to private ranges blocked (ADR-006).

### 3.4 PostgreSQL 18

**Responsibility:** durable safety records only — session metadata, reports, blocks,
bans, moderation actions, audit events, safety events, admin users.

**Does not hold:** chat content, media, queue state, connection registries, SDP, ICE
candidates.

---

## 4. Logical architecture (layers)

```
┌──────────────────────────────────────────────────────────────┐
│  app/            Route shells. No business logic.             │
├──────────────────────────────────────────────────────────────┤
│  features/       Feature slices: orchestration + UI + hooks.  │
│                  May call domain and server ports.            │
├──────────────────────────────────────────────────────────────┤
│  domain/         Pure domain types, invariants, state         │
│                  definitions. No I/O, no framework imports.   │
├──────────────────────────────────────────────────────────────┤
│  server/         Ports: auth, realtime, db, moderation,       │
│                  rate-limit, telemetry. Implementations live  │
│                  behind these ports and are NOT written yet.  │
├──────────────────────────────────────────────────────────────┤
│  shared/         contracts, types, validation, ui primitives. │
└──────────────────────────────────────────────────────────────┘
```

### Dependency direction

```
app ──► features ──► domain
 │          │
 │          └──────► server (ports)
 └─────────────────► shared
```

- `domain/` imports nothing except `shared/`.
- `shared/` imports nothing except `shared/`.
- `server/` is guarded by the `server-only` package marker so it cannot be imported into
  a client bundle (ADR-001 MR-3).
- `features/` may not import from another feature's internals; only from its public
  surface.

---

## 5. Realtime architecture

### 5.1 Two planes

```
SIGNALING PLANE — always via our server, TLS, authenticated, rate limited, schema-validated

  Client A ══ wss ══ Realtime Service ══ wss ══ Client B
                  │
                  └── emits domain events (ParticipantEnteredQueue, MatchCreated, …)

MEDIA PLANE — direct between browsers, SRTP over DTLS

  Client A ══════════ WebRTC media ══════════ Client B
                        │
                        └── via coturn relay when direct connectivity fails
```

The planes are never conflated in code: `src/features/signaling/` and
`src/features/media/` are separate modules with no imports between them.

### 5.2 Signaling relay rules

Restated from ADR-004 because they are the core security property:

1. Every frame is Zod-validated before dispatch.
2. `fromParticipantId` must equal the authenticated socket identity.
3. The recipient is **derived server-side** from the session.
4. `messageId` is idempotency-keyed per session.
5. `sequence` is monotonic per direction.
6. Payloads are opaque and size-capped.
7. Session state is authoritative server-side.

### 5.3 Matchmaking placement

Matchmaking runs **inside the realtime service**, in memory. It is not a separate
service and not a database-backed queue. Rationale in ADR-008.

---

## 6. Session lifecycle

Full state machine: [STATE_MACHINE.md](STATE_MACHINE.md).

```
CREATED → WAITING → MATCHED → CONNECTING → ACTIVE → ENDING → ENDED
                              │            │
                              └──► FAILED  └──► REPORTED ──► ENDED
                                             └──► BLOCKED ──► ENDED
WAITING → CANCELLED
```

---

## 7. Data architecture

### 7.1 State placement

| State | Location | Lifetime | Rationale |
| --- | --- | --- | --- |
| Queue entries | Realtime memory | Until matched, cancelled, or expired | Ephemeral; must not become a durable record |
| Connection registry | Realtime memory | Connection lifetime | Dies with the process |
| Active session record | Realtime memory | Session lifetime | Hot path |
| Chat messages | **Nowhere** | Session only | Privacy (ADR-013 Tier 0) |
| SDP / ICE | In-flight only | Negotiation window | Never stored |
| TURN credentials | Computed on demand | Minutes | Never stored |
| Session metadata | PostgreSQL | 30 days | Late reports, pattern investigation |
| Reports | PostgreSQL | 12 months | Repeat-offender detection, appeals |
| Moderation actions + audit | PostgreSQL | 24 months | Non-repudiation |
| Bans | PostgreSQL | 24 months, reviewed | Enforcement integrity |
| Telemetry | OTel backend | 13 months | Trends; no identities |

Full detail: [DATA_MODEL.md](DATA_MODEL.md), [RETENTION.md](RETENTION.md).

### 7.2 Why chat is not stored

This is a deliberate architectural decision with real costs (moderators cannot
reconstruct a conversation) and is not to be revisited casually. Storing random
strangers' conversations is the single largest privacy and liability risk available to
this product. ADR-010 and ADR-013 record the reasoning.

---

## 8. Safety architecture

```
                    ┌─────────────────────────────┐
                    │      Prevention layer       │
                    │  age gate, rate limits,     │
                    │  cooldowns, session caps,   │
                    │  eligibility checks         │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │    In-session layer         │
                    │  message rate limits,       │
                    │  duration caps,             │
                    │  one-session invariant      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Reaction layer            │
                    │  report → immediate end,    │
                    │  block → no rematch,        │
                    │  moderation disconnect      │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Enforcement layer         │
                    │  warn → disconnect →        │
                    │  restrict → ban,            │
                    │  checked at every entry     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Accountability layer      │
                    │  immutable audit log,       │
                    │  appeals, metrics          │
                    └─────────────────────────────┘
```

Every layer is a separate bounded context with its own port. Details:
[SAFETY.md](SAFETY.md), [MODERATION.md](MODERATION.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).

---

## 9. Failure isolation

| Failure | Blast radius | Behaviour |
| --- | --- | --- |
| Web service down | No new sessions, no reports via web | Existing sessions continue; report path degrades to a realtime-only path |
| Realtime service down | No new matches | Existing WebSocket connections drop; users returned to a clean state |
| Realtime instance restart | In-flight sessions on that instance | Ended with `server-restart`; queue lost; users informed |
| PostgreSQL down | No durable writes | New sessions may still start (queue is in-memory); reports queue or fail visibly; ban checks fail **closed** |
| coturn down | Video/audio on restrictive networks | Specific error state; text chat continues |
| OTel backend down | No telemetry | No user impact; alerts suppressed |
| One participant's network drops | One session | Peer sees "your stranger left"; session ends |

**Ban checks fail closed.** If the ban store is unreachable, we do not match. Availability
is traded for safety.

---

## 10. Scaling model

| Component | Scaling strategy | Current limit |
| --- | --- | --- |
| Web | Horizontal, stateless | Request-driven |
| Realtime | Horizontal **gated on Redis** (ADR-003) | Single instance until the gate is met |
| coturn | Bandwidth-driven, add nodes | Cost-driven |
| PostgreSQL | Vertical, then read replica | Volume-driven |

The realtime scaling gate is explicit: running more than one instance requires
cross-instance routing **and** the Redis decision in the same change.

---

## 11. What is deliberately absent

| Absent | Why |
| --- | --- |
| Message broker (Kafka/NATS) | Events are conceptual; in-process dispatch + durable rows suffice (EVENTS.md) |
| Redis | Not needed until multi-instance realtime (ADR-002) |
| SFU / MCU | Two-party product only (ADR-005) |
| Microservices | Four services is already the right granularity for one team |
| Kubernetes | Deferred; managed container platform until service count justifies it |
| CDN for media | Media is P2P; there is no media origin |
| Search infrastructure | Report triage is small-volume; PostgreSQL FTS first |
| Cache layer (Redis/app) | The product has almost no read-heavy durable data |
| Automated content moderation | Not in this phase (ADR-010) |
| Device fingerprinting | Deliberately excluded (ABUSE_PREVENTION.md) |

---

## 12. Module map

```
src/app/            Route shells (start, queue, chat/[sessionId], safety)
src/features/
  participant/      Session identity creation and lifecycle
  queue/            Join / cancel / wait state
  matchmaking/      Port + orchestration shell (no algorithm)
  session/          Session lifecycle shell
  chat/             Message composition shell
  signaling/        Signaling client + message dispatch
  media/            getUserMedia + RTCPeerConnection coordinator shell
  reports/          Report submission shell
  blocks/           Block creation shell
  moderation/       Moderation case ports
  safety/           Age gate, consent, safety notice
src/domain/
  participant/      Participant, SessionIdentity types and invariants
  matchmaking/      QueueTicket, MatchRequest, eligibility types
  session/          ChatSession, SessionStatus, transitions
  reports/          Report, ReportCategory types
  moderation/       ModerationAction, ModerationOutcome types
src/server/
  auth/             Authentication and authorization ports
  realtime/         WebSocket transport port
  db/               Repository ports (only place SQL may live)
  moderation/       Moderation service ports
  rate-limit/       Rate limiting ports
  telemetry/        Tracing and metrics helpers
src/shared/
  contracts/        Zod schemas and inferred types for every boundary
  types/            Cross-cutting types
  validation/       Validation helpers
  ui/               Accessible UI primitives
```

---

## 13. Traceability

Every architectural decision above maps to at least one requirement and one ADR. See
[docs/TRACEABILITY.md](docs/TRACEABILITY.md).

The architecture review, including the hard questions ("Is Redis actually necessary?",
"Are microservices actually necessary?", "Can one small team operate this?"), is in
[docs/architecture/FINAL-REVIEW.md](docs/architecture/FINAL-REVIEW.md).
