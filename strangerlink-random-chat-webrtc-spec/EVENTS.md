# StrangerLink — Domain Events

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [DOMAIN.md](DOMAIN.md), [STATE_MACHINE.md](STATE_MACHINE.md), [OBSERVABILITY.md](OBSERVABILITY.md)

> **No event bus exists.** Events are defined conceptually and dispatched in-process. **We
> do not introduce Kafka, NATS, RabbitMQ, or any message broker.** See §6.

---

## 0. Why events at all

Events serve three purposes here, and no others:

1. **Decoupling.** The conversation contexts must not import the enforcement contexts.
2. **Observability.** An event is the natural hook for a metric and a span.
3. **Auditability.** Safety events become durable records.

Events are **not** used for cross-service communication, and they are **not** replayed.

---

## 1. Event envelope

```typescript
interface DomainEvent<TType extends string, TPayload> {
  id: string;                 // uuidv7
  type: TType;
  occurredAt: string;         // ISO-8601 UTC
  sessionId: string | null;
  participantId: string | null;
  payload: TPayload;
}
```

**Rules**

| Rule | Detail |
| --- | --- |
| No content | Payloads never contain message bodies, report notes, SDP, or media |
| No addresses | Payloads never contain IP addresses, candidate strings, or ports |
| No peer pairing | An event never carries both participants' identifiers. It carries the session id and one participant id |
| UTC | All timestamps are UTC |
| Dispatch | In-process, synchronous where ordering matters, fire-and-forget where it does not |

---

## 2. Events

### 2.1 `ParticipantEnteredQueue`

| | |
| --- | --- |
| **Emitted by** | `queue` |
| **Trigger** | A participant joins the queue |
| **Payload** | `{ mode, interestCount, hasLanguage, hasRegionConstraint }` |
| **Consumers** | Telemetry (queue size gauge), safety (eligibility snapshot) |
| **Notes** | Carries interest **count**, never interest values |

### 2.2 `ParticipantLeftQueue`

| | |
| --- | --- |
| **Emitted by** | `queue` |
| **Trigger** | Cancel, expiry, or disconnect |
| **Payload** | `{ reasonClass: 'user-cancelled' \| 'queue-expired' \| 'cooldown' \| 'restricted' \| 'disconnected', waitedMs }` |
| **Consumers** | Telemetry (abandonment), matchmaking (release claim) |

### 2.3 `MatchCreated`

| | |
| --- | --- |
| **Emitted by** | `matchmaking` |
| **Trigger** | Two eligible participants are paired atomically |
| **Payload** | `{ sessionId, mode, participantAId, participantBId, interestOverlap, matchedAt }` |
| **Consumers** | `session` (state transition), telemetry (match latency) |
| **Notes** | This is the one event that carries both participant ids — it is the moment the pair comes into existence. It is never logged; it is used to construct the session and is then discarded |

### 2.4 `SessionStarted`

| | |
| --- | --- |
| **Emitted by** | `session` |
| **Trigger** | `MATCHED → CONNECTING` or `MATCHED → ACTIVE` |
| **Payload** | `{ sessionId, mode }` |
| **Consumers** | Telemetry (session creation rate) |

### 2.5 `PeerConnected`

| | |
| --- | --- |
| **Emitted by** | `media` |
| **Trigger** | Media established (media modes) |
| **Payload** | `{ sessionId, mode, path: 'direct' \| 'relay', setupMs }` |
| **Consumers** | Telemetry (setup duration, TURN share) |
| **Notes** | `path` is the only network-topology fact recorded. It is not an address |

### 2.6 `PeerDisconnected`

| | |
| --- | --- |
| **Emitted by** | `session` |
| **Trigger** | A peer's transport is lost |
| **Payload** | `{ sessionId, reasonClass: 'peer-left' \| 'transport-lost' \| 'skipped', recoverable }` |
| **Consumers** | `session` (state), telemetry |

### 2.7 `SessionEnded`

| | |
| --- | --- |
| **Emitted by** | `session` |
| **Trigger** | A terminal transition |
| **Payload** | `{ sessionId, endReason, durationMs }` |
| **Consumers** | Telemetry (duration, end-reason distribution), `reports` (unblock reporting window) |
| **Notes** | `endReason` is an enum, never free text |

### 2.8 `MessageSent`

| | |
| --- | --- |
| **Emitted by** | `chat` |
| **Trigger** | A message is relayed |
| **Payload** | `{ sessionId, participantId, sequence, lengthBucket }` |
| **Consumers** | Telemetry (message rate) |
| **Notes** | **`lengthBucket` is a coarse bucket. The body is never present in the payload and never will be.** |

### 2.9 `ReportCreated`

| | |
| --- | --- |
| **Emitted by** | `reports` |
| **Trigger** | A report is submitted |
| **Payload** | `{ reportId, sessionId, category, severity, reporterIdentityId, peerIdentityId }` |
| **Consumers** | `moderation` (case creation), `bans` (enforcement check), telemetry (report rate) |
| **Notes** | The note is deliberately excluded from the event payload. It lives only on the durable report record, in the moderation surface |

### 2.10 `BlockCreated`

| | |
| --- | --- |
| **Emitted by** | `blocks` |
| **Trigger** | A block is created |
| **Payload** | `{ blockId, sessionId, scope, blockerIdentityId, blockedIdentityId }` |
| **Consumers** | `matchmaking` (candidate constraint), `session` (terminate) |

### 2.11 `ModerationActionApplied`

| | |
| --- | --- |
| **Emitted by** | `moderation` |
| **Trigger** | A moderator applies an outcome |
| **Payload** | `{ actionId, caseId, action, actorId, targetIdentityId, reasonCode, policyVersion }` |
| **Consumers** | `bans` (create/revoke), `session` (disconnect), telemetry |
| **Notes** | Never carries the report note or any content |

### 2.12 `BanApplied`

| | |
| --- | --- |
| **Emitted by** | `bans` |
| **Trigger** | A ban is created, extended, or revoked |
| **Payload** | `{ banId, subjectType, subjectId, severity, source, expiresAt, policyVersion }` |
| **Consumers** | `matchmaking` (eligibility), `realtime` (connection refusal), telemetry |

### 2.13 `SafetyEventRaised`

| | |
| --- | --- |
| **Emitted by** | any context |
| **Trigger** | A safety-relevant occurrence |
| **Payload** | `{ safetyEventId, type, participantId, sessionId }` |
| **Types** | `age-attested`, `consent-accepted`, `minor-detected`, `escalation-raised`, `session-terminated`, `rate-limit-triggered`, `protocol-violation`, `permission-denied` |
| **Consumers** | Durable `SafetyEvent` row, telemetry, escalation routing |

### 2.14 `RateLimitTriggered`

| | |
| --- | --- |
| **Emitted by** | `rate-limit` |
| **Trigger** | A limit is exceeded |
| **Payload** | `{ limitName, scope, participantId, retryAfterMs }` |
| **Consumers** | `SafetyEventRaised`, telemetry |

### 2.15 `ProtocolViolationDetected`

| | |
| --- | --- |
| **Emitted by** | `signaling` |
| **Trigger** | Impersonation, cross-session attempt, forbidden field, oversized payload |
| **Payload** | `{ violationClass, sessionId }` |
| **Consumers** | `SafetyEventRaised`, connection termination, telemetry, **alerting** |
| **Notes** | Never carries the offending payload |

---

## 3. Event → state mapping

| Event | Session state |
| --- | --- |
| `ParticipantEnteredQueue` | `CREATED → WAITING` |
| `ParticipantLeftQueue` | `WAITING → CANCELLED` |
| `MatchCreated` | `WAITING → MATCHED` |
| `SessionStarted` | `MATCHED → CONNECTING` |
| `PeerConnected` | `CONNECTING → ACTIVE` |
| `PeerDisconnected` | `ACTIVE → ENDING` |
| `ReportCreated` | `ACTIVE → REPORTED` |
| `BlockCreated` | `ACTIVE → BLOCKED` |
| `ModerationActionApplied` (disconnect) | `ACTIVE → ENDING` |
| `SessionEnded` | `ENDING → ENDED` |

---

## 4. Event ordering guarantees

| Guarantee | Detail |
| --- | --- |
| Per-session ordering | Events for one session are dispatched in occurrence order |
| Cross-session ordering | **Not guaranteed.** Sessions are independent |
| Delivery | In-process, at-least-once within the process; no cross-process delivery |
| Durability | Only safety events and moderation events are written durably, as rows |
| Replay | **Not supported.** There is no event log to replay |

---

## 5. Consumers and dependency direction

```
queue ──────► ParticipantEnteredQueue ──────► telemetry
matchmaking ► MatchCreated ────────────────► session
session ────► SessionStarted / SessionEnded ► telemetry, reports
media ──────► PeerConnected ───────────────► telemetry
chat ───────► MessageSent ─────────────────► telemetry
reports ────► ReportCreated ───────────────► moderation, bans
blocks ─────► BlockCreated ────────────────► matchmaking
moderation ─► ModerationActionApplied ─────► bans, session
bans ───────► BanApplied ──────────────────► matchmaking, realtime
any ────────► SafetyEventRaised ───────────► durable store, escalation
```

Note that `chat` emits only to `telemetry`. **`chat` never emits to `moderation`.** This is
the structural expression of the rule that chat cannot influence enforcement.

---

## 6. Why no message broker

| Consideration | Position |
| --- | --- |
| Volume | Safety events are low-volume; chat events are high-volume but carry no value after the session |
| Consumers | All consumers are in-process |
| Durability | Achieved by writing rows directly where durability matters |
| Operational cost | A broker is another system to run, secure, and monitor |
| Failure semantics | A broker introduces at-least-once delivery problems we would have to solve for no benefit |
| Future | If fan-out or volume genuinely requires a broker, it needs an ADR |

**Decision: no broker.** In-process dispatch plus durable rows for the events that must
survive.

---

## 7. Implementation status

Event types are defined in [src/shared/contracts/events.ts](src/shared/contracts/events.ts)
and per-context types in [src/domain/](src/domain/). No dispatcher exists. Tracked within
VS-3 through VS-14.
