# StrangerLink — Signaling Protocol

- **Status:** Architecture phase
- **Last updated:** 2026-09-26
- **Related:** [ADR-003](docs/adr/ADR-003-realtime-transport.md), [ADR-004](docs/adr/ADR-004-signaling-model.md), [STATE_MACHINE.md](STATE_MACHINE.md)

> **Schemas only. No WebSocket server exists.** The transport port in
> [src/server/realtime/](src/server/realtime/) throws `Not implemented`.

---

## 1. Transport

| Property | Value |
| --- | --- |
| Protocol | WebSocket (RFC 6455) |
| Scheme | `wss://` only |
| Library | `ws` |
| Authentication | During the HTTP upgrade handshake, before the socket opens |
| Origin | Allowlist checked during the handshake |
| Frame format | JSON, UTF-8 |
| `maxPayload` | 64 KiB (generous for signaling; a hard second layer) |
| Heartbeat | Protocol-level ping/pong; zombies are terminated |
| Rate limit | Per-connection token bucket on frames |

---

## 2. Envelope

**Every** message, in both directions, uses this envelope.

```typescript
interface SignalingEnvelope {
  type: SignalingMessageType;   // discriminated union tag
  messageId: string;            // uuidv7, idempotency key, unique per session
  sessionId: string | null;     // null only for pre-session messages (JOIN_QUEUE)
  fromParticipantId: string;    // MUST equal the authenticated socket identity
  toParticipantId?: never;      // FORBIDDEN — recipient is derived server-side
  sequence: number;             // monotonic per session per direction
  sentAt: string;               // ISO-8601 UTC
  payload: unknown;             // shape determined by `type`, validated by Zod
}
```

### Envelope rules

| Rule | Enforcement |
| --- | --- |
| `fromParticipantId` must equal the authenticated identity | Checked once in the dispatch layer; mismatch closes the connection and raises a safety event |
| `toParticipantId` must never be present | Schema forbids it; presence closes the connection |
| Recipient is derived server-side from `sessionId` | Structural |
| `messageId` is unique per session | Deduplication table |
| `sequence` is monotonic per direction | Buffered within a window, then rejected |
| `sessionId` is null only for `JOIN_QUEUE` | Schema |

---

## 3. Message types

### 3.1 Lifecycle

#### `JOIN_QUEUE` — client → server

```typescript
interface JoinQueueMessage {
  type: 'JOIN_QUEUE';
  messageId: string;
  sessionId: null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    mode: ChatMode;                    // TEXT | TEXT_AUDIO | TEXT_VIDEO
    interestIds: string[];             // max 5, from the closed vocabulary
    language: string | null;           // BCP-47
    regionConstraint: string | null;   // coarse region code
    consentVersion: number;            // must match the server's current version
  };
}
```

| Field | Validation |
| --- | --- |
| `mode` | Must be an enabled mode; media modes are rejected if the kill switch is off |
| `interestIds` | ≤ 5; all must exist in the active vocabulary |
| `language` | BCP-47 format |
| `consentVersion` | Must equal the server's current version, else the client is told to re-consent |

#### `MATCH_FOUND` — server → client

```typescript
interface MatchFoundMessage {
  type: 'MATCH_FOUND';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;           // the server's identity on the channel
  sequence: number;
  sentAt: string;
  payload: {
    sessionId: string;
    peerRole: 'A' | 'B';
    mode: ChatMode;
    matchedAt: string;
    interestOverlap: number;           // 0..n; informational, peer interests are NOT disclosed
  };
}
```

#### `SESSION_READY` — bidirectional

```typescript
interface SessionReadyMessage {
  type: 'SESSION_READY';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    ready: boolean;
    reason?: 'media-ready' | 'text-only' | 'media-declined';
  };
}
```

#### `PEER_LEFT` — bidirectional / server

```typescript
interface PeerLeftMessage {
  type: 'PEER_LEFT';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    reasonClass: 'peer-left' | 'skipped' | 'reported' | 'blocked' | 'timeout' | 'transport-lost';
    // NOTE: never 'banned-you' or any moderation detail
  };
}
```

#### `SESSION_ENDED` — server → client

```typescript
interface SessionEndedMessage {
  type: 'SESSION_ENDED';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    endReason: SessionEndReason;
    durationMs: number;
    requeueOffered: boolean;
  };
}
```

#### `QUEUE_CANCELLED` — server → client

```typescript
interface QueueCancelledMessage {
  type: 'QUEUE_CANCELLED';
  messageId: string;
  sessionId: null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    reasonClass: 'user-cancelled' | 'queue-expired' | 'cooldown' | 'restricted';
    retryAfterMs?: number;
  };
}
```

### 3.2 Media negotiation

#### `OFFER` — bidirectional

```typescript
interface OfferMessage {
  type: 'OFFER';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    sdp: string;                       // opaque to the server; max 16 KiB
    restart: boolean;                  // true when this is an ICE restart offer
  };
}
```

#### `ANSWER` — bidirectional

```typescript
interface AnswerMessage {
  type: 'ANSWER';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    sdp: string;                       // opaque to the server; max 16 KiB
  };
}
```

#### `ICE_CANDIDATE` — bidirectional

```typescript
interface IceCandidateMessage {
  type: 'ICE_CANDIDATE';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    candidate: string | null;          // null marks end-of-candidates
    sdpMid: string | null;
    sdpMLineIndex: number | null;
    usernameFragment: string | null;
  };
}
```

### 3.3 Chat

#### `MESSAGE_SEND` — client → server

```typescript
interface MessageSendMessage {
  type: 'MESSAGE_SEND';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    clientMessageId: string;           // for local dedup
    body: string;                      // max 2000 chars
  };
}
```

#### `MESSAGE_DELIVERED` — server → recipient

```typescript
interface MessageDeliveredMessage {
  type: 'MESSAGE_DELIVERED';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;           // the sender's identity
  sequence: number;                    // the sender's sequence
  sentAt: string;
  payload: {
    clientMessageId: string | null;
    body: string;
    deliveredAt: string;
  };
}
```

#### `MESSAGE_REJECTED` — server → sender

```typescript
interface MessageRejectedMessage {
  type: 'MESSAGE_REJECTED';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    clientMessageId: string;
    reasonClass: 'too-long' | 'rate-limited' | 'spam' | 'not-in-session' | 'protocol-error';
  };
}
```

### 3.4 Safety

#### `REPORT_SUBMITTED` — client → server

```typescript
interface ReportSubmittedMessage {
  type: 'REPORT_SUBMITTED';
  messageId: string;
  sessionId: string;                   // may be a terminal session (INV-8)
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    category: ReportCategory;
    note: string | null;               // max 1000 chars, sanitised
  };
}
```

#### `BLOCK_CREATED` — client → server

```typescript
interface BlockCreatedMessage {
  type: 'BLOCK_CREATED';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    scope: 'session' | 'platform';
  };
}
```

#### `MODERATION_NOTICE` — server → client

```typescript
interface ModerationNoticeMessage {
  type: 'MODERATION_NOTICE';
  messageId: string;
  sessionId: string | null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    noticeClass: 'warning' | 'disconnected' | 'restricted' | 'banned';
    message: string;                   // fixed, non-revealing copy from a allowlist
    canReport: boolean;                // always true — the user can always appeal
  };
}
```

**Critical:** `MODERATION_NOTICE.message` is selected from a fixed allowlist of strings.
It never contains the triggering rule, the signal, the actor type, or any detail that
would help an abuser calibrate (NFR-SAFE-002).

#### `SAFETY_RESTRICTED` — server → client

```typescript
interface SafetyRestrictedMessage {
  type: 'SAFETY_RESTRICTED';
  messageId: string;
  sessionId: null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    restrictionClass: 'cooldown' | 'temporary' | 'banned';
    retryAfterMs: number | null;
    canReport: boolean;
  };
}
```

#### `SESSION_SUPERSEDED` — server → client

```typescript
interface SessionSupersededMessage {
  type: 'SESSION_SUPERSEDED';
  messageId: string;
  sessionId: string;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    reasonClass: 'another-tab' | 'reconnect-superseded';
  };
}
```

Handles R8 and R12.

---

## 4. Union type

```typescript
export type SignalingMessage =
  | JoinQueueMessage
  | MatchFoundMessage
  | SessionReadyMessage
  | PeerLeftMessage
  | SessionEndedMessage
  | QueueCancelledMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | MessageSendMessage
  | MessageDeliveredMessage
  | MessageRejectedMessage
  | ReportSubmittedMessage
  | BlockCreatedMessage
  | ModerationNoticeMessage
  | SafetyRestrictedMessage
  | SessionSupersededMessage;
```

Defined in [src/shared/contracts/signaling.ts](src/shared/contracts/signaling.ts).

---

## 5. Error handling

Errors are **never** sent as raw exceptions. The server sends a structured notice:

```typescript
interface SignalingErrorMessage {
  type: 'ERROR';
  messageId: string;
  sessionId: string | null;
  fromParticipantId: string;
  sequence: number;
  sentAt: string;
  payload: {
    code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'NOT_IN_SESSION'
      | 'SESSION_ENDED'
      | 'SESSION_SUPERSEDED'
      | 'VALIDATION_FAILED'
      | 'RATE_LIMITED'
      | 'MODE_DISABLED'
      | 'CONSENT_REQUIRED'
      | 'RESTRICTED'
      | 'PAYLOAD_TOO_LARGE'
      | 'DUPLICATE_MESSAGE'
      | 'SEQUENCE_VIOLATION'
      | 'INTERNAL';
    message: string;      // from a fixed allowlist; never a stack trace
    retryable: boolean;
    retryAfterMs?: number;
  };
}
```

`INTERNAL` never includes a stack trace, a query, a hostname, or an IP address.

---

## 6. Connection lifecycle

```
1. Client opens wss:// with an auth token in the handshake
2. Server validates token + origin  ── fail ──► close(1008)
3. Socket opens
4. Client sends JOIN_QUEUE
5. Server validates eligibility  ── fail ──► ERROR(RESTRICTED) / QUEUE_CANCELLED
6. ... match ... MATCH_FOUND
7. SESSION_READY exchange
8. Media negotiation (media modes)
9. Chat / media
10. Peer leaves / skip / report / block / timeout
11. SESSION_ENDED
12. Client closes, or reconnects
```

### Close codes

| Code | Meaning |
| --- | --- |
| 1000 | Normal closure |
| 1001 | Going away (navigation) |
| 1008 | Policy violation (unauthenticated, bad origin, protocol violation) |
| 1011 | Internal error |
| 4001 | Application-defined: identity superseded |
| 4002 | Application-defined: banned or restricted |
| 4003 | Application-defined: payload too large |

---

## 7. Rate limits (per connection unless noted)

| Message | Limit |
| --- | --- |
| Any frame | 30/second, burst 60 |
| `JOIN_QUEUE` | 1 per 5 seconds per identity |
| `MESSAGE_SEND` | 1 per second, burst 5 |
| `OFFER` / `ANSWER` | 10 per session |
| `ICE_CANDIDATE` | 100 per session |
| `REPORT_SUBMITTED` | 5 per hour per identity |
| `BLOCK_CREATED` | 10 per hour per identity |

Exceeding a limit yields `ERROR(RATE_LIMITED)` with `retryAfterMs`, and a rate-limit
safety event.

---

## 8. What this protocol deliberately does not do

| Not done | Why |
| --- | --- |
| Typing indicators | Behavioural leakage; noise |
| Read receipts | Pressure mechanic |
| Presence / online status | Not meaningful for strangers |
| Peer addressing | Recipient is always server-derived (ADR-004) |
| Peer metadata disclosure | No name, location, device, or interests |
| Server-side SDP parsing | Opaque relay (ADR-004) |
| Message persistence | Nothing is stored (ADR-013) |
| Binary frames | Text/JSON only |

---

## 9. Implementation status

Zod schemas and TypeScript types are defined as **contracts** in
[src/shared/contracts/](src/shared/contracts/). No server, no client transport, no
dispatch logic exists. Tracked as **T-SIG-011** in [TASKS.md](TASKS.md).
