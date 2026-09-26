# StrangerLink — Domain Model

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DATA_MODEL.md](DATA_MODEL.md), [STATE_MACHINE.md](STATE_MACHINE.md), [EVENTS.md](EVENTS.md)

---

## 1. Approach

StrangerLink uses **bounded contexts** to keep the safety-critical parts of the system
separated from the conversational parts. The rule that matters most:

> **The conversation contexts (queue, matchmaking, chat, media, signaling) may never
> depend on the enforcement contexts (moderation, reports, blocks, bans). The enforcement
> contexts may depend on the conversation contexts' *outputs* — never on their content.**

This keeps a moderation bug from becoming a chat-availability bug, and keeps a chat
feature from being able to weaken enforcement.

---

## 2. Bounded contexts

### 2.1 `participant`

**Owns:** who is here, pseudonymously.

| Concept | Description |
| --- | --- |
| `Participant` | A pseudonymous session identity. No account, no credential, no profile |
| `SessionIdentity` | The identity attached to a participant; may carry a hashed risk signal |
| `ParticipantStatus` | `ACTIVE` \| `RESTRICTED` \| `BANNED` |

**Invariants**

- A participant has at most one active session (INV-1).
- A participant is created without any personal data.
- A participant cannot be looked up by anything a user typed.

**Depends on:** nothing.

---

### 2.2 `queue`

**Owns:** who is waiting, and for what.

| Concept | Description |
| --- | --- |
| `QueueTicket` | A claim on a queue position |
| `QueueEntry` | Mode, interests, language, region constraint, eligibility snapshot, joinedAt |

**Invariants**

- One active ticket per participant (FR-QUEUE-001).
- Cancellation is immediate and safe at any instant (FR-QUEUE-002, FR-QUEUE-007).
- Queue entries are ephemeral and are never durable records.
- Wait is bounded (FR-QUEUE-006).

**Depends on:** `participant`, `safety` (eligibility).

---

### 2.3 `matchmaking`

**Owns:** the decision about who talks to whom.

| Concept | Description |
| --- | --- |
| `MatchRequest` | Mode, interests, language, region constraint |
| `MatchResult` | Matched pair, or a definitive negative result |
| `EligibilityCheck` | Ban, restriction, block, recent-peer, active-session checks |

**Invariants (MC-1 … MC-10, ADR-008)**

- A departed participant is never matched.
- Blocked pairs are never matched.
- Concurrent attempts resolve to exactly one session.
- Session creation is atomic.
- Interests and language are preferences, never guarantees.

**Depends on:** `participant`, `queue`, `safety` (blocks, bans), `session`.

**Does not depend on:** `chat`, `media`, `signaling`.

---

### 2.4 `session`

**Owns:** the lifecycle of a two-person conversation.

| Concept | Description |
| --- | --- |
| `ChatSession` | Two participants, a mode, a status, timestamps |
| `SessionStatus` | See [STATE_MACHINE.md](STATE_MACHINE.md) |
| `SessionEndReason` | `peer-left`, `skip`, `report`, `block`, `timeout`, `moderation`, `server-restart`, `failed` |

**Invariants**

- Exactly two distinct participants (INV-2).
- Status transitions follow the state machine only (INV-3).
- Terminal sessions never reactivate (INV-4).
- Reports may reference a terminal session (INV-8).

**Depends on:** `participant`, `matchmaking`.

---

### 2.5 `chat`

**Owns:** ephemeral text exchange.

| Concept | Description |
| --- | --- |
| `ChatMessage` | In-memory only; never persisted |
| `MessageSequence` | Monotonic per session per direction |
| `DeliveryStatus` | `pending` \| `delivered` \| `rejected` |

**Invariants**

- Messages are never written to durable storage (FR-CHAT-008).
- Message length is bounded (FR-CHAT-003).
- Message rate is limited per participant per session (FR-CHAT-004).
- Links are inert; no attachments (FR-CHAT-005, FR-CHAT-006).

**Depends on:** `session`.

---

### 2.6 `media`

**Owns:** camera and microphone.

| Concept | Description |
| --- | --- |
| `MediaMode` | `TEXT` \| `TEXT_AUDIO` \| `TEXT_VIDEO` |
| `PeerConnectionCoordinator` | Port for browser-side WebRTC lifecycle |
| `MediaState` | `idle` \| `requesting` \| `active` \| `denied` \| `failed` \| `stopped` |

**Invariants**

- Media requires an explicit user gesture (FR-MEDIA-003).
- No recording, ever (FR-MEDIA-008).
- Media failure never silently ends the session (FR-MEDIA-007).
- Mode is enforced at match time (FR-MEDIA-009).

**Depends on:** `session`, `signaling`.

---

### 2.7 `signaling`

**Owns:** the message plane between two matched clients and the server.

| Concept | Description |
| --- | --- |
| `SignalingMessage` | Discriminated union; see [SIGNALING.md](SIGNALING.md) |
| `SignalingEnvelope` | `sessionId`, `fromParticipantId`, `messageId`, `sequence`, `type` |
| `TransportPort` | WebSocket abstraction |

**Invariants**

- Every frame is schema-validated.
- `fromParticipantId` equals the authenticated identity.
- The recipient is derived server-side.
- `messageId` is idempotency-keyed; `sequence` is monotonic.

**Depends on:** `session`.

---

### 2.8 `reports`

**Owns:** what a user tells us went wrong.

| Concept | Description |
| --- | --- |
| `Report` | Session-scoped safety report |
| `ReportCategory` | Fixed enumeration |
| `ReportSeverity` | P0 / P1 / P2 |

**Invariants**

- Reports survive session end (FR-REPORT-002).
- No personal information is collected (FR-REPORT-005).
- Duplicates are collapsed (FR-REPORT-006).
- Reports are rate limited (FR-REPORT-007).
- P0 categories escalate immediately (FR-REPORT-010).

**Depends on:** `session`, `participant`.

---

### 2.9 `blocks`

**Owns:** "don't put me with this person again".

| Concept | Description |
| --- | --- |
| `Block` | Blocker, blocked, scope, expiry |
| `BlockScope` | `session` \| `platform` |

**Invariants**

- Blocks prevent immediate rematch (FR-BLOCK-002).
- Block state survives reload within the browser session (FR-BLOCK-004).
- Blocks are re-checked at candidate selection, not only at queue join.

**Depends on:** `participant`, `session`.

---

### 2.10 `bans`

**Owns:** "this identity cannot participate".

| Concept | Description |
| --- | --- |
| `Ban` | Subject, reason code, severity, source, expiry |
| `Restriction` | Temporary inability to join the queue |

**Invariants**

- Bans are checked at every entry point (FR-MOD-008).
- Ban records contain no name, email, phone, or IP.
- Risk signals can only trigger rate limits and cooldowns, never standalone bans
  (ADR-012 MR-2).

**Depends on:** `participant`, `moderation`.

---

### 2.11 `moderation`

**Owns:** review and enforcement decisions.

| Concept | Description |
| --- | --- |
| `ModerationCase` | A triaged report |
| `ModerationAction` | allow \| warn \| disconnect \| restrict \| ban \| manual-review |
| `AuditEvent` | Append-only record of every action |

**Invariants**

- Every action has an actor, a reason code, and a timestamp (FR-MOD-004).
- Moderators see no chat content and no media (ADR-010).
- No action without an audit record.
- No automated content model in this phase (FR-MOD-006).

**Depends on:** `reports`, `bans`, `blocks`, `session`, `participant`.

---

### 2.12 `safety`

**Owns:** the gates and policies that apply before and during a session.

| Concept | Description |
| --- | --- |
| `AgeAttestation` | Self-declared 18+, versioned |
| `ConsentRecord` | Acknowledged safety notice, versioned |
| `SafetyEvent` | Append-only record of gate passage, escalations, terminations |
| `EscalationPolicy` | P0 routing rules |

**Invariants**

- No chat capability before age gate and consent (FR-ENTRY-005).
- Consent is versioned so policy changes re-prompt (FR-ENTRY-009).
- Escalations are not queued behind routine triage (FR-SAFE-008).

**Depends on:** nothing (it is a policy context).

---

### 2.13 `telemetry`

**Owns:** observability without content.

| Concept | Description |
| --- | --- |
| `TraceContext` | Correlation ids |
| `MetricDefinition` | Name, type, labels (low-cardinality only) |
| `SafetyAlert` | Alert definition with a runbook reference |

**Invariants**

- No content attributes, ever (ADR-015).
- No peer linkage within a span.
- No IP or device identifiers.
- Metric labels are enumerations only.

**Depends on:** nothing.

---

## 3. Dependency direction

```
                    ┌──────────────┐
                    │   telemetry  │  (depends on nothing)
                    └──────────────┘
                    ┌──────────────┐
                    │    safety    │  (depends on nothing)
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  participant  │  │    reports    │  │    blocks     │
└───┬───────────┘  └───┬───────────┘  └───┬───────────┘
    │                  │                  │
    ▼                  │                  │
┌───────────────┐      │                  │
│     queue     │      │                  │
└───┬───────────┘      │                  │
    │                  │                  │
    ▼                  │                  │
┌───────────────┐      │                  │
│  matchmaking  │◄─────┼──────────────────┘
└───┬───────────┘      │
    │                  │
    ▼                  ▼
┌───────────────┐  ┌───────────────┐
│    session    │◄─│   moderation  │
└───┬───────────┘  └───┬───────────┘
    │                  │
    ├──────────┐       │
    ▼          ▼       ▼
┌────────┐ ┌────────┐ ┌───────────────┐
│  chat  │ │ media  │ │     bans      │
└────────┘ └───┬────┘ └───────────────┘
               │
               ▼
        ┌─────────────┐
        │  signaling  │
        └─────────────┘
```

### Allowed dependency directions

| From | May depend on |
| --- | --- |
| `telemetry`, `safety` | — |
| `participant` | `safety`, `telemetry` |
| `queue` | `participant`, `safety` |
| `matchmaking` | `participant`, `queue`, `safety`, `session` (types only) |
| `session` | `participant`, `matchmaking` (types only) |
| `chat`, `media` | `session`, `telemetry` |
| `signaling` | `session`, `telemetry` |
| `reports`, `blocks` | `participant`, `session` |
| `bans` | `participant`, `moderation` |
| `moderation` | `reports`, `bans`, `blocks`, `session`, `participant` |

### Forbidden dependencies

- `chat` → `moderation`. Chat must not be able to influence enforcement decisions.
- `media` → `moderation`. Same reason.
- `matchmaking` → `chat` / `media` / `signaling`. Matching happens before any of them.
- `queue` → `session`. Queue entries do not hold sessions.
- Any context → `telemetry` internals beyond the public helper.

---

## 4. Ownership

| Context | Owner | On-call scope |
| --- | --- | --- |
| `participant`, `session`, `queue`, `matchmaking` | Product engineering | Availability |
| `chat`, `media`, `signaling` | Realtime engineering | Availability |
| `safety`, `reports`, `blocks`, `bans`, `moderation` | Trust & Safety | **Safety incidents page** |
| `telemetry` | SRE | Observability |

Trust & Safety owns the enforcement contexts and can require changes in the conversation
contexts when a safety property is at risk. This is a deliberate asymmetry of authority.

---

## 5. Cross-context communication

Contexts communicate through:

1. **Domain events** ([EVENTS.md](EVENTS.md)) — in-process dispatch; no broker.
2. **Ports** — explicit interfaces in `src/server/` and each feature's public surface.
3. **Direct type imports** — only where the dependency direction allows it.

They do **not** communicate through shared mutable state, and they do not communicate by
one context reaching into another's internals.

---

## 6. Anti-corruption layers

The boundary most likely to leak is `moderation` → `session`. Moderators need session
metadata but must never receive content. The ACL is:

- `moderation` receives a `SessionSummary` (mode, duration, timestamps, end reason,
  participant ids, risk signals) — never a `ChatSession` with any message reference,
  because messages do not exist durably.

Similarly, `telemetry` receives `SpanAttributes` through a single allowlisted helper, not
raw domain objects.
